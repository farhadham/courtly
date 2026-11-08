-- Custom SQL migration file, put your code below! --

-- Migration 0004 tightens the court price check to `> 0`. A price of 0 was legal
-- before that, so this preflight refuses to start rather than lets 0004 fail
-- with an opaque constraint error.
DO $$
DECLARE
  offending integer;
BEGIN
  SELECT count(*) INTO offending FROM "courts" WHERE "hourly_price_cents" <= 0;

  IF offending > 0 THEN
    RAISE EXCEPTION
      'Preflight for migration 0004: % court(s) have hourly_price_cents <= 0; give them a positive price and re-run',
      offending;
  END IF;
END $$;