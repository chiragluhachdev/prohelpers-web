"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, rupees } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, SectionTitle, Select, SkeletonRows, Table, Tabs, Toggle,
} from "@/components/ui";

type PriceRow = {
  code: string; name: string; listPrice: number; price: number;
  source: "catalog" | "fallback" | "fixed"; difference: number;
};

type Locality = {
  id: string; code: string; name: string; area: string; city: string; pincode: string;
  lat: number; lng: number; radiusKm?: number; active: boolean; sortOrder: number;
  pricing: {
    fallback: "catalog" | "percent" | "flat"; fallbackValue: number;
    prices: { serviceCode: string; price: number }[];
    version: number; updatedAt?: string;
  };
  fallbackText: string;
  fixedCount: number;
  addresses: number;
  prices: PriceRow[];
};

type Payload = {
  services: { code: string; name: string; basePrice: number }[];
  localities: Locality[];
};

type HistoryRow = {
  id: string; version: number; field: "price" | "fallback";
  serviceCode: string; serviceName: string;
  from: number | { rule: string; value: number } | null;
  to: number | { rule: string; value: number } | null;
  byName: string; reason: string; at: string;
};

type Details = { name: string; area: string; city: string; pincode: string; lat: string; lng: string; radiusKm: string; active: boolean };

const blankDetails: Details = { name: "", area: "", city: "", pincode: "", lat: "", lng: "", radiusKm: "1", active: true };

/**
 * An OpenStreetMap view of a locality's centre, framed to its pin-detection
 * radius — so an admin can see the centre is on the estate before saving.
 */
function osmEmbed(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function LocalityMap({ lat, lng, radiusKm, height = 220 }: { lat: number; lng: number; radiusKm: number; height?: number }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) {
    return (
      <div className="grid place-items-center rounded-[10px] border border-dashed border-line-strong bg-sunken text-[13px] text-ink-muted" style={{ height }}>
        No centre set — addresses here can&apos;t be found from a map pin.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <iframe title="Locality centre" src={osmEmbed(lat, lng, radiusKm)} className="block w-full" style={{ height, border: 0 }} loading="lazy" />
      <div className="flex items-center justify-between gap-2 bg-surface px-3 py-1.5 text-[12px] text-ink-muted">
        <span>A customer&apos;s pin within {radiusKm} km of the marker is placed in this locality.</span>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-medium text-forest-700 hover:underline"
        >
          Open map
        </a>
      </div>
    </div>
  );
}

const signed = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${rupees(Math.abs(n))}`);

const ruleText = (r: { rule: string; value: number } | null) => {
  if (!r) return "—";
  if (r.rule === "percent" && r.value) return `Catalog ${r.value > 0 ? "+" : "−"}${Math.abs(r.value)}%`;
  if (r.rule === "flat" && r.value) return `Catalog ${r.value > 0 ? "+" : "−"}₹${Math.abs(r.value)}`;
  return "Catalog prices";
};

/**
 * UC-C43 — locality pricing. Each locality has its own price list: a fixed
 * price per service where one is set, and a fallback rule for the rest. Every
 * save is a new version with its changes recorded; bookings keep the prices
 * and version they were made with.
 */
export default function LocalitiesPage() {
  const { data, error, loading, reload } = useApi<Payload>("/api/admin/localities");
  const [tab, setTab] = useState<"prices" | "compare">("prices");
  const [selected, setSelected] = useState<string>("");

  const localities = data?.localities ?? [];
  const services = data?.services ?? [];
  const current = localities.find((l) => l.code === selected) ?? localities[0] ?? null;

  useEffect(() => {
    if (!selected && localities[0]) setSelected(localities[0].code);
  }, [localities, selected]);

  const [detailsOpen, setDetailsOpen] = useState<"new" | "edit" | null>(null);
  const [details, setDetails] = useState<Details>(blankDetails);
  const [detailsError, setDetailsError] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  function openDetails(mode: "new" | "edit") {
    setDetailsError("");
    setDetails(
      mode === "edit" && current
        ? {
            name: current.name, area: current.area, city: current.city, pincode: current.pincode,
            lat: String(current.lat ?? ""), lng: String(current.lng ?? ""), radiusKm: String(current.radiusKm ?? 1.5),
            active: current.active,
          }
        : { ...blankDetails, area: current?.area || "", city: current?.city || "", pincode: current?.pincode || "" },
    );
    setDetailsOpen(mode);
  }

  async function saveDetails() {
    setSavingDetails(true);
    setDetailsError("");
    try {
      const body = {
        ...details,
        lat: details.lat === "" ? undefined : Number(details.lat),
        lng: details.lng === "" ? undefined : Number(details.lng),
        radiusKm: details.radiusKm === "" ? undefined : Number(details.radiusKm),
      };
      if (detailsOpen === "edit" && current) {
        await api(`/api/admin/localities/${current.code}`, { method: "PUT", body });
      } else {
        const res = await api<{ locality: { code: string } }>("/api/admin/localities", { method: "POST", body });
        setSelected(res.locality.code);
      }
      setDetailsOpen(null);
      await reload();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Locality pricing"
        subtitle="Every place you serve, with its own prices. A service with no fixed price in a locality uses that locality's fallback."
        action={<Button onClick={() => openDetails("new")}>Add locality</Button>}
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "prices", label: "Price lists" },
            { key: "compare", label: "Compare localities" },
          ]}
        />
      </div>

      {loading && !data ? (
        <Card padded={false}><SkeletonRows rows={5} cols={4} /></Card>
      ) : localities.length === 0 ? (
        <Card><EmptyState title="No localities yet" body="Add the first place you serve to start pricing it." /></Card>
      ) : tab === "compare" ? (
        <CompareGrid localities={localities} services={services} onOpen={(code) => { setSelected(code); setTab("prices"); }} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* ---------------------------------------------- the localities */}
          <Card padded={false}>
            <div className="divide-y divide-line">
              {localities.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setSelected(l.code)}
                  className={`block w-full px-4 py-3 text-left transition-colors ${
                    current?.code === l.code ? "bg-forest-50" : "hover:bg-sunken"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[14px] font-medium ${current?.code === l.code ? "text-forest-800" : "text-ink"}`}>{l.name}</p>
                    {!l.active && <Badge tone="slate">Off</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {l.fixedCount} fixed · {l.fallbackText}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {current && (
            <PriceList
              key={`${current.code}:${current.pricing?.version ?? 0}`}
              locality={current}
              localities={localities}
              onEditDetails={() => openDetails("edit")}
              onSaved={reload}
            />
          )}
        </div>
      )}

      {/* ---------------------------------------------- locality details */}
      <Modal
        open={Boolean(detailsOpen)}
        title={detailsOpen === "edit" ? `Edit ${current?.name}` : "Add a locality"}
        subtitle={
          detailsOpen === "edit"
            ? "Switching it off hides it from the apps and stops new bookings there. People and bookings already in it are left alone."
            : "It starts on catalog prices — set its own prices once it is added."
        }
        onClose={() => setDetailsOpen(null)}
      >
        <div className="grid gap-4">
          {detailsError && <ErrorNote>{detailsError}</ErrorNote>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="RPS Savana" />
            </Field>
            <Field label="Area">
              <Input value={details.area} onChange={(e) => setDetails({ ...details, area: e.target.value })} placeholder="Sector 88" />
            </Field>
            <Field label="City">
              <Input value={details.city} onChange={(e) => setDetails({ ...details, city: e.target.value })} placeholder="Faridabad" />
            </Field>
            <Field label="Pincode">
              <Input value={details.pincode} onChange={(e) => setDetails({ ...details, pincode: e.target.value })} placeholder="121002" />
            </Field>
            <Field label="Latitude" hint="The estate's centre. In OpenStreetMap, right-click the gate → Show address.">
              <Input value={details.lat} onChange={(e) => setDetails({ ...details, lat: e.target.value })} placeholder="28.4148" />
            </Field>
            <Field label="Longitude">
              <Input value={details.lng} onChange={(e) => setDetails({ ...details, lng: e.target.value })} placeholder="77.3543" />
            </Field>
            <Field label="Pin detection radius" hint="km from the centre. Keep it small where estates sit side by side.">
              <Input type="number" min={0.1} max={50} step={0.1} value={details.radiusKm} onChange={(e) => setDetails({ ...details, radiusKm: e.target.value })} />
            </Field>
          </div>
          <LocalityMap
            lat={details.lat === "" ? NaN : Number(details.lat)}
            lng={details.lng === "" ? NaN : Number(details.lng)}
            radiusKm={Number(details.radiusKm) || 1.5}
            height={200}
          />
          <Toggle
            on={details.active}
            onChange={(active) => setDetails({ ...details, active })}
            label="Served"
            help="Off: not offered in the apps, and no new bookings."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDetailsOpen(null)}>Cancel</Button>
            <Button disabled={savingDetails || !details.name.trim()} onClick={saveDetails}>
              {savingDetails ? "Saving…" : detailsOpen === "edit" ? "Save" : "Add locality"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------ price list */

function PriceList({
  locality,
  localities,
  onEditDetails,
  onSaved,
}: {
  locality: Locality;
  localities: Locality[];
  onEditDetails: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [fallback, setFallback] = useState(locality.pricing?.fallback || "catalog");
  const [fallbackValue, setFallbackValue] = useState(String(locality.pricing?.fallbackValue ?? 0));
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries((locality.pricing?.prices || []).map((p) => [p.serviceCode, String(p.price)])),
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [bulkPercent, setBulkPercent] = useState("10");
  const [copyFrom, setCopyFrom] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useApi<{ history: HistoryRow[] }>(historyOpen ? `/api/admin/localities/${locality.code}/history` : null);

  /** What each service would cost with the prices as they are typed right now. */
  const rows = useMemo(() => {
    const v = Number(fallbackValue) || 0;
    return locality.prices.map((r) => {
      const typed = prices[r.code];
      const fixed = typed !== undefined && typed !== "" && Number.isFinite(Number(typed));
      let price = r.listPrice;
      let source: PriceRow["source"] = "catalog";
      if (fixed) {
        price = Number(typed);
        source = "fixed";
      } else if (fallback === "percent" && v) {
        price = Math.round(Math.max(0, r.listPrice * (1 + v / 100)) * 100) / 100;
        source = "fallback";
      } else if (fallback === "flat" && v) {
        price = Math.round(Math.max(0, r.listPrice + v) * 100) / 100;
        source = "fallback";
      }
      return { ...r, price, source, difference: Math.round((price - r.listPrice) * 100) / 100 };
    });
  }, [locality.prices, prices, fallback, fallbackValue]);

  const savedPrices = Object.fromEntries((locality.pricing?.prices || []).map((p) => [p.serviceCode, String(p.price)]));
  const dirty =
    fallback !== (locality.pricing?.fallback || "catalog") ||
    (Number(fallbackValue) || 0) !== (locality.pricing?.fallbackValue || 0) ||
    JSON.stringify(Object.entries(prices).filter(([, v]) => v !== "").sort()) !==
      JSON.stringify(Object.entries(savedPrices).sort());

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      await api(`/api/admin/localities/${locality.code}/pricing`, {
        method: "PUT",
        body: {
          fallback,
          fallbackValue: Number(fallbackValue) || 0,
          prices: Object.entries(prices).map(([serviceCode, price]) => ({ serviceCode, price: price === "" ? null : Number(price) })),
          reason: reason.trim(),
        },
      });
      setReason("");
      await onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!copyFrom) return;
    const from = localities.find((l) => l.code === copyFrom);
    if (!confirm(`Replace ${locality.name}'s prices with ${from?.name}'s? The change is saved as a new version.`)) return;
    setSaving(true);
    setSaveError("");
    try {
      await api(`/api/admin/localities/${locality.code}/pricing/copy`, { method: "POST", body: { from: copyFrom } });
      setCopyFrom("");
      await onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not copy.");
    } finally {
      setSaving(false);
    }
  }

  /** Fill every service with catalog ± a percentage, as fixed prices — then adjust the odd one by hand. */
  function fillFromCatalog() {
    const pct = Number(bulkPercent) || 0;
    setPrices(Object.fromEntries(locality.prices.map((r) => [r.code, String(Math.round(r.listPrice * (1 + pct / 100)))])));
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{locality.name}</h2>
              {locality.active ? <Badge tone="green">Served</Badge> : <Badge tone="slate">Not served</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {[locality.area, locality.city, locality.pincode].filter(Boolean).join(" · ") || "No area set"} ·{" "}
              {locality.addresses} saved address{locality.addresses === 1 ? "" : "es"} · map pins within{" "}
              {locality.radiusKm ?? 1.5} km
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              Price list version {locality.pricing?.version ?? 0}
              {locality.pricing?.updatedAt ? ` · last changed ${dateTime(locality.pricing.updatedAt)}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>Price history</Button>
            <Button size="sm" variant="secondary" onClick={onEditDetails}>Edit details</Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Services without a fixed price" />
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Select value={fallback} onChange={(e) => setFallback(e.target.value as Locality["pricing"]["fallback"])}>
            <option value="catalog">Use the catalog price</option>
            <option value="percent">Catalog price ± a percentage</option>
            <option value="flat">Catalog price ± an amount</option>
          </Select>
          {fallback !== "catalog" && (
            <Input
              value={fallbackValue}
              onChange={(e) => setFallbackValue(e.target.value)}
              placeholder={fallback === "percent" ? "e.g. 10 or −5" : "e.g. 20 or −10"}
            />
          )}
        </div>
        <p className="mt-2 text-[12px] text-ink-muted">
          A new service added to the catalog is priced by this until you give it a fixed price here.
        </p>
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <SectionTitle title="Prices here" />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-muted">Fill all from catalog</span>
            <Input className="h-8 w-20" value={bulkPercent} onChange={(e) => setBulkPercent(e.target.value)} />
            <span className="text-[12px] text-ink-muted">%</span>
            <Button size="sm" variant="secondary" onClick={fillFromCatalog}>Fill</Button>
            <Button size="sm" variant="ghost" onClick={() => setPrices({})}>Clear fixed prices</Button>
          </div>
        </div>
        <Table head={["Service", "Catalog", "Fixed price here", "Customer pays", "vs catalog"]}>
          {rows.map((r) => (
            <Row key={r.code}>
              <Cell className="text-[13.5px]">{r.name}</Cell>
              <Cell className="tabular text-[13px] text-ink-muted">{rupees(r.listPrice)}</Cell>
              <Cell>
                <Input
                  className="h-9 w-28"
                  placeholder="—"
                  inputMode="decimal"
                  value={prices[r.code] ?? ""}
                  onChange={(e) => setPrices({ ...prices, [r.code]: e.target.value })}
                />
              </Cell>
              <Cell>
                <span className="tabular text-[13.5px] font-medium">{rupees(r.price)}</span>
                <span className="ml-2 text-[11px] text-ink-muted">
                  {r.source === "fixed" ? "fixed" : r.source === "fallback" ? "fallback" : "catalog"}
                </span>
              </Cell>
              <Cell className={`tabular text-[13px] ${r.difference > 0 ? "text-amber-ink" : r.difference < 0 ? "text-forest-700" : "text-ink-muted"}`}>
                {signed(r.difference)}
              </Cell>
            </Row>
          ))}
        </Table>
        <p className="px-5 pb-4 pt-2 text-[12px] text-ink-muted">
          Prices are for the service itself; answers to its questions still add on top. Blank uses the fallback above.
        </p>
      </Card>

      <Card>
        {saveError && <div className="mb-3"><ErrorNote>{saveError}</ErrorNote></div>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Why the change?" hint="Kept in the price history.">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="New rates from October" />
            </Field>
          </div>
          <Button disabled={saving || !dirty} onClick={save}>
            {saving ? "Saving…" : dirty ? "Save as new version" : "No changes"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="text-[13px] text-ink-soft">Or copy every price from</span>
          <Select className="h-9 w-56" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">Choose a locality…</option>
            {localities.filter((l) => l.code !== locality.code).map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" disabled={!copyFrom || saving} onClick={copy}>Copy</Button>
        </div>
        <p className="mt-2 text-[12px] text-ink-muted">
          Bookings already made keep the prices they were booked at. Changes apply to new bookings only.
        </p>
      </Card>

      <Modal open={historyOpen} title={`Price history · ${locality.name}`} size="lg" onClose={() => setHistoryOpen(false)}>
        {history.loading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : !history.data?.history.length ? (
          <EmptyState title="No changes yet" body="Every saved change to this locality's prices is recorded here." />
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            <Table head={["Version", "What", "From", "To", "Who and when"]}>
              {history.data.history.map((h) => (
                <Row key={h.id}>
                  <Cell className="tabular text-[13px]">v{h.version}</Cell>
                  <Cell className="text-[13px]">
                    {h.field === "fallback" ? "Fallback rule" : h.serviceName}
                    {h.reason && <p className="text-[11.5px] text-ink-muted">{h.reason}</p>}
                  </Cell>
                  <Cell className="tabular text-[13px] text-ink-muted">
                    {h.field === "fallback" ? ruleText(h.from as { rule: string; value: number }) : h.from == null ? "Fallback" : rupees(h.from as number)}
                  </Cell>
                  <Cell className="tabular text-[13px] font-medium">
                    {h.field === "fallback" ? ruleText(h.to as { rule: string; value: number }) : h.to == null ? "Fallback" : rupees(h.to as number)}
                  </Cell>
                  <Cell className="whitespace-nowrap text-[12px] text-ink-muted">{h.byName} · {dateTime(h.at)}</Cell>
                </Row>
              ))}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------- comparison */

function CompareGrid({
  localities,
  services,
  onOpen,
}: {
  localities: Locality[];
  services: { code: string; name: string; basePrice: number }[];
  onOpen: (code: string) => void;
}) {
  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-sunken/80">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">Service</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">Catalog</th>
              {localities.map((l) => (
                <th key={l.code} className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">
                  <button onClick={() => onOpen(l.code)} className="hover:text-forest-700 hover:underline">
                    {l.name}{!l.active ? " (off)" : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((sv) => (
              <tr key={sv.code} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-2.5 text-ink">{sv.name}</td>
                <td className="tabular px-4 py-2.5 text-right text-ink-muted">{rupees(sv.basePrice)}</td>
                {localities.map((l) => {
                  const row = l.prices.find((p) => p.code === sv.code);
                  return (
                    <td key={l.code} className="tabular px-4 py-2.5 text-right">
                      <span className={row?.source === "fixed" ? "font-semibold text-ink" : row?.source === "fallback" ? "text-amber-ink" : "text-ink-muted"}>
                        {row ? rupees(row.price) : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-[12px] text-ink-muted">
        <span className="font-semibold text-ink">Bold</span> is a fixed price, <span className="text-amber-ink">amber</span> comes from the locality&apos;s fallback, grey is the catalog price.
      </p>
    </Card>
  );
}
