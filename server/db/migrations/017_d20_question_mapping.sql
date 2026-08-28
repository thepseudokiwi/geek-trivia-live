ALTER TABLE episode_questions ADD COLUMN d20_value INTEGER;
UPDATE episode_questions AS target
SET d20_value = (
  SELECT mapped.roll_value
  FROM (
    SELECT episode_id,question_id,ROW_NUMBER() OVER (PARTITION BY episode_id ORDER BY random()) AS roll_value
    FROM episode_questions
    WHERE category_position < 4
  ) AS mapped
  WHERE mapped.episode_id = target.episode_id AND mapped.question_id = target.question_id
)
WHERE target.category_position < 4;

CREATE UNIQUE INDEX idx_episode_questions_d20_value
ON episode_questions(episode_id,d20_value)
WHERE d20_value IS NOT NULL;
