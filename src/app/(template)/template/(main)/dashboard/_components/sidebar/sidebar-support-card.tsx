import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Replaces the template's upstream promo card. Everything here is session-only,
 * so this card states that instead of linking out to the template author.
 */
export function SidebarSupportCard() {
  return (
    <Card size="sm" className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">Session only</CardTitle>
        <CardDescription className="line-clamp-2">
          Your inventory and settings live in memory and reset when Stashly closes.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
