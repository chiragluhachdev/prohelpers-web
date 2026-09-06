/* eslint-disable @next/next/no-img-element */

/** The PH monogram. Plain <img> so it renders identically at any size. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Pro Helper"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    />
  );
}
