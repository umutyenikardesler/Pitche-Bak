-- follow_requests FK'larını CASCADE yap - auth.users silmeyi engelliyordu
-- (follower_id ve following_id NO ACTION idi)
ALTER TABLE public.follow_requests
  DROP CONSTRAINT IF EXISTS follow_requests_follower_id_fkey,
  ADD CONSTRAINT follow_requests_follower_id_fkey
    FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.follow_requests
  DROP CONSTRAINT IF EXISTS follow_requests_following_id_fkey,
  ADD CONSTRAINT follow_requests_following_id_fkey
    FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
