-- Made task-photos bucket private (BUG #157 in .claude/skills/scoop-bug-log/SKILL.md)
-- Photos were previously public — anyone with a photo_url could view it with
-- no authentication. uploadPhoto() now stores the storage PATH instead of a
-- public URL; display goes through useSignedUrl() (1hr expiry) instead.
UPDATE storage.buckets SET public = false WHERE name = 'task-photos';
