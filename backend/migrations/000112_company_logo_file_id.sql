-- 000112: finish, for company_settings, what 000011 started for everything else
--
-- Migration 000011 added a *_file_id column beside every *_url and backfilled
-- it. Products, variants, categories and product_media then switched over on
-- both read and write. company_settings never did: the settings screen kept
-- sending logo_url and kept reading logo_url.
--
-- Both halves of that were already dead. The Go API has no logo_url field in
-- either its request or its response DTOs -- the string appears nowhere in the
-- backend -- so the value sent on save was dropped during JSON decoding, and
-- the value read on load was never in the payload. The company logo has
-- therefore not been settable or displayable for as long as that mismatch has
-- existed. It looks like it works, because the preview shows a local object URL
-- for the file just chosen, and it disappears on the next page load.
--
-- The fix is in the application: the screen now reads and writes logo_file_id
-- and logo_storage_path like every other image in the system. This migration
-- only makes sure no row is left with its logo stranded in the old column.
--
-- Expected to affect zero rows on a database where 000011 ran and nothing wrote
-- logo_url afterwards -- which is what the code says should be true. It is here
-- because "should be true" and "is true" have differed once already on this
-- column, and a row that slipped through would otherwise show no logo with
-- nothing to explain why.

UPDATE company_settings
   SET logo_file_id = logo_url
 WHERE logo_url IS NOT NULL
   AND logo_url <> ''
   -- Never overwrite a file id that is already set. Same guard 000011 used, for
   -- the same reason: logo_file_id is the live column now, so an existing value
   -- there is newer than anything in logo_url.
   AND coalesce(logo_file_id, '') = ''
   -- A genuine URL is not a file id and must not be copied into one. It would
   -- be handed to Appwrite's preview endpoint as an id and produce a broken
   -- image, where leaving it alone lets the read fall back to it as a plain URL
   -- and render correctly.
   AND logo_url NOT LIKE 'http://%'
   AND logo_url NOT LIKE 'https://%'
   AND logo_url NOT LIKE '//%'
   AND logo_url NOT LIKE '/%';

-- logo_url is deliberately left as it was. Every other column in this migration
-- family was added beside its predecessor rather than replacing it, and the
-- read path falls back through it, so leaving it costs nothing and keeps the
-- change reversible by redeploying the previous frontend.
