export const DEFAULT_COUNTRY_CODE = "234";

export function normalizePhone(
  value: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
) : string | null {
  const digits = value.replace(/\D/g, "");
  const countryCode = defaultCountryCode.replace(/\D/g, "");

  if (
    !digits ||
    !countryCode ||
    (digits.startsWith(countryCode) && digits.length !== 13) ||
    (!digits.startsWith(countryCode) &&
      !digits.startsWith("0") &&
      digits.length !== 10) ||
    (digits.startsWith("0") && digits.length !== 11)
  ) {
    return null;
  }

  if (digits.startsWith(countryCode) && digits.length === 13) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+${countryCode}${digits.slice(1)}`;
  }

  return `+${countryCode}${digits}`;
}
