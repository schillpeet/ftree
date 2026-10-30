-- Family names were unique across everyone, so a taken name told a user that someone else's tree had it.
-- Now they are unique per creator; families from before V18 have no creator and are not checked here.
DROP INDEX families_name_lower_idx;
CREATE UNIQUE INDEX families_created_by_name_lower_idx ON families (created_by, lower(name));
