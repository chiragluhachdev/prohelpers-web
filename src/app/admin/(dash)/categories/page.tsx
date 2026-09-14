"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, SkeletonRows, Table, Toggle,
} from "@/components/ui";

type Category = {
  _id: string;
  name: string;
  nameHi?: string;
  icon: string;
  color: string;
  active: boolean;
  sortOrder: number;
  comingSoon: boolean;
};

type Draft = Partial<Category> & { _id?: string };

export default function CategoriesPage() {
  const { data, error, loading, reload } = useApi<Category[]>("/api/admin/categories");

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (editing) setDraft({ ...editing });
  }, [editing]);

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setDraft({});
    setFormError("");
  };

  async function save() {
    setBusy("save");
    setFormError("");
    try {
      if (creating) {
        await api("/api/admin/categories", { method: "POST", body: draft });
      } else if (editing) {
        await api(`/api/admin/categories/${editing._id}`, { method: "PUT", body: draft });
      }
      await reload();
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy("");
    }
  }

  async function toggleActive(c: Category) {
    setBusy(c._id);
    try {
      await api(`/api/admin/categories/${c._id}`, { method: "PUT", body: { active: !c.active } });
      await reload();
    } finally {
      setBusy("");
    }
  }

  const categories = data ?? [];
  const liveCount = categories.filter((c) => c.active).length;
  const modalOpen = creating || !!editing;

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Manage the service categories displayed on the customer home screen."
        action={
          <Button
            onClick={() => {
              setCreating(true);
              setDraft({ icon: "grid", color: "forest700", sortOrder: categories.length + 1, active: true, comingSoon: false });
            }}
          >
            Add category
          </Button>
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <Card>
        <Table
          head={["Name", "Icon", "Sort Order", "Coming Soon", "Active"]}
        >
          {loading ? (
            <SkeletonRows />
          ) : categories.length === 0 ? (
            <EmptyState title="No categories found" body="Add one to get started." />
          ) : (
            categories.map((c) => (
              <Row
                key={c._id}
                onClick={() => setEditing(c)}
              >
                <Cell className={!c.active ? "opacity-60" : ""}>
                  <p className="font-medium text-ink">{c.name}</p>
                  {c.nameHi && <p className="text-[13px] text-ink-muted">{c.nameHi}</p>}
                </Cell>
                <Cell>
                  <Badge tone="sky">{c.icon}</Badge>
                </Cell>
                <Cell>
                  <p className="font-mono text-[13px] text-ink-muted">{c.sortOrder}</p>
                </Cell>
                <Cell>
                  {c.comingSoon ? <Badge tone="amber">Yes</Badge> : <p className="text-ink-muted">—</p>}
                </Cell>
                <Cell>
                  <Toggle
                    on={c.active}
                    label={c.active ? "Live" : "Off"}
                    onChange={() => toggleActive(c)}
                  />
                </Cell>
              </Row>
            ))
          )}
        </Table>
      </Card>
      {categories.length > 0 && (
        <p className="mt-4 text-[13px] text-ink-muted">{liveCount} live categories</p>
      )}

      {/* Editor Modal */}
      <Modal
        open={modalOpen}
        title={creating ? "Add Category" : "Edit Category"}
        onClose={closeForm}
      >
        {formError && <div className="mb-4"><ErrorNote>{formError}</ErrorNote></div>}

        <div className="space-y-5">
          <Field label="Category Name">
            <Input
              autoFocus
              value={draft.name || ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Plumbing"
            />
          </Field>

          <Field label="Hindi Name" hint="Optional, displayed in Hindi UI">
            <Input
              value={draft.nameHi || ""}
              onChange={(e) => setDraft({ ...draft, nameHi: e.target.value })}
              placeholder="e.g. प्लम्बर"
            />
          </Field>

          <div className="flex gap-4">
            <div className="flex-1">
              <Field label="Icon Name" hint="Ionicon name (e.g. home, build, bulb)">
                <Input
                  value={draft.icon || ""}
                  onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                  placeholder="e.g. home"
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Color Theme" hint="e.g. forest700, ember">
                <Input
                  value={draft.color || ""}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  placeholder="e.g. forest700"
                />
              </Field>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Field label="Sort Order">
                <Input
                  type="number"
                  value={draft.sortOrder ?? 0}
                  onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Coming Soon" hint="Shows an alert instead of navigating">
                <Toggle
                  on={Boolean(draft.comingSoon)}
                  label={draft.comingSoon ? "Yes" : "No"}
                  onChange={(next) => setDraft({ ...draft, comingSoon: next })}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button onClick={save} disabled={busy === "save" || !draft.name}>
              {busy === "save" ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
