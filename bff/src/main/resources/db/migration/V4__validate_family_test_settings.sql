ALTER TABLE families
    ADD CONSTRAINT families_test_settings_check CHECK (
        (
            total_users IS NULL AND generation_count IS NULL
            AND min_children IS NULL AND max_children IS NULL
        )
        OR (
            total_users IS NOT NULL
            AND generation_count IS NOT NULL
            AND min_children IS NOT NULL
            AND max_children IS NOT NULL
            AND total_users BETWEEN 1 AND 250
            AND generation_count BETWEEN 1 AND 10
            AND min_children BETWEEN 0 AND 3
            AND max_children BETWEEN min_children AND 3
        )
    );
