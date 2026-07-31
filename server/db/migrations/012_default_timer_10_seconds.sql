UPDATE episodes
SET timer_duration_ms = 10000,
    timer_remaining_ms = 10000
WHERE timer_status = 'idle';
