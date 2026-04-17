-- Purge legacy broken seed assets that no longer have private sources.
-- These paths must never re-enter the Discover corpus.

delete from public.profile_photos
where storage_path in ('seed/seedA.jpg', 'seed/seedB.jpg');

delete from storage.objects
where bucket_id in ('profile-photos', 'profile-photos-public')
  and name in (
    'seed/seedA.jpg',
    'seed/seedB.jpg',
    'variants/card/seed/seedA.jpg',
    'variants/avatar/seed/seedA.jpg',
    'variants/profile/seed/seedA.jpg',
    'variants/card/seed/seedB.jpg',
    'variants/avatar/seed/seedB.jpg',
    'variants/profile/seed/seedB.jpg'
  );
