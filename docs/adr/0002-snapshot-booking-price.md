# Bookings snapshot the court price

A booking stores `price_cents` at creation time — the court's hourly price multiplied by its
duration — rather than joining to `court.hourly_price_cents` when revenue is calculated. Revenue is
a historical fact: if an admin raises a court's price tomorrow, last month's takings must not
change. Joining live would make the admin day-view quietly rewrite the past every time a price is
edited.

**Consequences**

- The booking row is denormalised on purpose. A reviewer will notice the duplicated price; this
  document is the reason.
- Day revenue is `SUM(price_cents)` over non-cancelled bookings — no join, no multiplication at read
  time.
- A court's price change is forward-looking only. There is no backfill path, and none is wanted.
- If we later add discounts or promo pricing, they hang off the same snapshot column rather than
  introducing a second source of truth for "what this booking cost".
