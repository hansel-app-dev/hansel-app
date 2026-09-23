/** @spec sign-additional-type-options REQ-001..REQ-006 */
import {
  signMountingOptions,
  signMountingSchema,
  type SignMounting,
} from '@hansel/contracts';
import { SignAttributeSelect } from './SignAttributeSelect.js';

export function SignMountingSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: SignMounting;
  onChange: (value: SignMounting) => void;
  disabled?: boolean;
}) {
  return (
    <SignAttributeSelect
      label="Type"
      value={value}
      options={signMountingOptions}
      disabled={disabled}
      onChange={(option) => {
        onChange(signMountingSchema.parse(option));
      }}
      icon={(option) => (
        <SignMountingIcon value={signMountingSchema.parse(option)} />
      )}
    />
  );
}

export function SignMountingIcon({ value }: { value: SignMounting }) {
  const icons: Record<SignMounting, string> = {
    Freestanding: '/assets/sign-freestanding.png',
    'Wall-mounted': '/assets/sign-wall-mounted.png',
    Overhead: '/assets/sign-overhead.png',
    Cantilevered: '/assets/sign-cantilevered.png',
    Floor: '/assets/sign-floor.svg',
    'Safety Decal': '/assets/sign-safety-decal.png',
    'Privacy Decal': '/assets/sign-privacy-decal.png',
    Environmental: '/assets/sign-environmental.png',
  };
  return (
    <img
      src={icons[value]}
      alt=""
      aria-hidden="true"
      data-mounting={value}
      width="24"
      height="24"
      className="block shrink-0"
    />
  );
}
