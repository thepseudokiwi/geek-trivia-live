UPDATE d20_settings
SET config_json = json_set(config_json, '$.soundEnabled', json('true')),
    updated_at = CURRENT_TIMESTAMP;

UPDATE episodes
SET d20_override_json = json_set(d20_override_json, '$.soundEnabled', json('true'))
WHERE d20_override_json IS NOT NULL;

UPDATE d20_effects
SET name = 'Critical Hit: Triple XP', effect_type = 'multiplier', score_multiplier = 3,
    flat_bonus = 0, applies_to = 'correct_award',
    public_description = 'Natural 20 — a correct answer is worth triple XP!',
    private_instructions = 'Correct award is automatically set to base XP × 3.'
WHERE min_roll = 20 AND max_roll = 20;

UPDATE d20_effects
SET name = 'Critical Failure', effect_type = 'critical_failure', score_multiplier = 1,
    flat_bonus = 0, applies_to = 'wrong_answer_consequence',
    public_description = 'Natural 1 — an incorrect answer automatically loses the question’s base XP.',
    private_instructions = 'An incorrect answer automatically deducts the question’s base XP.'
WHERE min_roll = 1 AND max_roll = 1;
