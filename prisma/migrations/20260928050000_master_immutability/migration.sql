-- MASTER FILES ARE SACRED — database-level defence in depth.
-- Even a buggy code path or a manual query cannot re-point, re-checksum or
-- delete an ingested master, nor re-point a stored version.

CREATE OR REPLACE FUNCTION oceanx_protect_master() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.checksum IS NOT NULL THEN
      RAISE EXCEPTION 'OCEANX: master % is immutable and cannot be deleted', OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.storage_key IS DISTINCT FROM OLD.storage_key THEN
    RAISE EXCEPTION 'OCEANX: master storage_key is immutable (%).', OLD.id;
  END IF;
  IF OLD.checksum IS NOT NULL AND NEW.checksum IS DISTINCT FROM OLD.checksum THEN
    RAISE EXCEPTION 'OCEANX: master checksum is immutable once recorded (%).', OLD.id;
  END IF;
  IF OLD.checksum IS NOT NULL AND NEW.size IS DISTINCT FROM OLD.size THEN
    RAISE EXCEPTION 'OCEANX: master size is immutable once recorded (%).', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_files_protect_master
  BEFORE UPDATE OR DELETE ON "media_files"
  FOR EACH ROW EXECUTE FUNCTION oceanx_protect_master();

CREATE OR REPLACE FUNCTION oceanx_protect_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'OCEANX: media versions are permanent (%).', OLD.id;
  END IF;
  IF NEW.storage_key IS DISTINCT FROM OLD.storage_key
     OR NEW.checksum IS DISTINCT FROM OLD.checksum
     OR NEW.size IS DISTINCT FROM OLD.size
     OR NEW.version_type IS DISTINCT FROM OLD.version_type
     OR NEW.is_master_ref IS DISTINCT FROM OLD.is_master_ref THEN
    RAISE EXCEPTION 'OCEANX: stored version content is immutable (%).', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_versions_protect
  BEFORE UPDATE OR DELETE ON "media_versions"
  FOR EACH ROW EXECUTE FUNCTION oceanx_protect_version();
