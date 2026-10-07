export type SaleGroupLine = {
  id: number | string;
  service: string;
  quantity: number;
  unit_price: number | null;
  price?: number | null;
  unit_cost?: number | null;
  line_total: number | null;
  created_at: string;
  created_by?: string | null;
  created_by_name: string | null;
  sale_group_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export type SaleGroup<T extends SaleGroupLine> = {
  id: string;
  saleGroupId: string | null;
  lines: T[];
  total: number;
  unitCount: number;
  earliestTimestamp: string;
  created_by: string | null;
  created_by_name: string | null;
  voided: boolean;
};

export function groupSaleRows<T extends SaleGroupLine>(
  rows: T[],
): SaleGroup<T>[] {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key =
      row.sale_group_id == null
        ? `line:${String(row.id)}`
        : `group:${row.sale_group_id}`;
    const lines = grouped.get(key);
    if (lines) {
      lines.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  return Array.from(grouped, ([key, lines]) => {
    const earliestTimestamp = lines.reduce(
      (earliest, line) =>
        new Date(line.created_at).getTime() < new Date(earliest).getTime()
          ? line.created_at
          : earliest,
      lines[0].created_at,
    );
    return {
      id: key,
      saleGroupId: lines[0].sale_group_id,
      lines,
      total: lines.reduce(
        (sum, line) =>
          sum + (line.voided_at == null ? line.line_total ?? 0 : 0),
        0,
      ),
      unitCount: lines.reduce((sum, line) => sum + (line.quantity || 0), 0),
      earliestTimestamp,
      created_by: lines.find((line) => line.created_by)?.created_by ?? null,
      created_by_name:
        lines.find((line) => line.created_by_name)?.created_by_name ?? null,
      voided: lines.every((line) => line.voided_at != null),
    };
  });
}

export function describeSaleGroup<T extends SaleGroupLine>(
  group: SaleGroup<T>,
  maxItems = 3,
) {
  const visible = group.lines.slice(0, maxItems).map(
    (line) => `${line.service} x${line.quantity}`,
  );
  const remaining = group.lines.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? ` +${remaining} more` : ""}`;
}
