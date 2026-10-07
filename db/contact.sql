BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'object'),
  notification_status text NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'accepted', 'unconfirmed')),
  provider_id text
);
CREATE INDEX IF NOT EXISTS contact_messages_created_at ON public.contact_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS public.contact_rate_limits (
  key text PRIMARY KEY,
  events timestamptz[] NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS contact_rate_limits_updated_at ON public.contact_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.reserve_contact_message(p_id uuid, p_ip_key text, p_email_key text, p_fields jsonb)
RETURNS TABLE (allowed boolean, retry_after integer)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  bucket_key text;
  active_events timestamptz[];
  submitted_at timestamptz;
  retry_seconds integer := 0;
BEGIN
  IF p_ip_key !~ '^ip:[0-9a-f]{64}$' OR p_email_key !~ '^email:[0-9a-f]{64}$' OR jsonb_typeof(p_fields) <> 'object' THEN
    RAISE EXCEPTION 'Invalid contact reservation';
  END IF;
  -- Sorted transaction locks serialize both identities across serverless instances without deadlocks.
  FOR bucket_key IN SELECT unnest(ARRAY[p_ip_key, p_email_key]) ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(bucket_key, 0));
  END LOOP;
  submitted_at := clock_timestamp();
  FOR bucket_key IN SELECT unnest(ARRAY[p_ip_key, p_email_key]) LOOP
    SELECT coalesce(array_agg(entry ORDER BY entry), ARRAY[]::timestamptz[]) INTO active_events
      FROM public.contact_rate_limits bucket CROSS JOIN LATERAL unnest(bucket.events) entry
      WHERE bucket.key = bucket_key AND entry > submitted_at - interval '1 hour';
    IF cardinality(active_events) >= 3 THEN
      retry_seconds := greatest(retry_seconds, ceil(extract(epoch FROM active_events[cardinality(active_events) - 2] + interval '1 hour' - submitted_at))::integer);
    END IF;
  END LOOP;
  IF retry_seconds > 0 THEN
    RETURN QUERY SELECT false, greatest(1, retry_seconds);
    RETURN;
  END IF;
  FOR bucket_key IN SELECT unnest(ARRAY[p_ip_key, p_email_key]) LOOP
    INSERT INTO public.contact_rate_limits AS bucket (key, events, updated_at)
    VALUES (bucket_key, ARRAY[submitted_at], submitted_at)
    ON CONFLICT (key) DO UPDATE SET
      events = ARRAY(SELECT entry FROM unnest(bucket.events) entry WHERE entry > submitted_at - interval '1 hour') || submitted_at,
      updated_at = submitted_at;
  END LOOP;
  INSERT INTO public.contact_messages (id, created_at, fields) VALUES (p_id, submitted_at, p_fields);
  RETURN QUERY SELECT true, 0;
END;
$$;

REVOKE ALL ON public.contact_messages, public.contact_rate_limits FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_contact_message(uuid, text, text, jsonb) FROM PUBLIC;

COMMIT;
