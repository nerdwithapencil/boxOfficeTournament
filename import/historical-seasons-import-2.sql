-- Historical seasons: 2018, 2019, 2020, 2021, 2022, 2023

insert into public.seasons (id, year, state, is_historical) values
  ('66085457-95a8-4093-9b69-45666922be35', 2018, 'ended', true);

insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values
  ('66085457-95a8-4093-9b69-45666922be35', '45eed1fc-3a68-4b52-9535-8cdfc0079439', 1, 160, 'The Avengers: Infinity War', true),
  ('66085457-95a8-4093-9b69-45666922be35', '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf', 3, 136, 'The Avengers: Infinity War', true),
  ('66085457-95a8-4093-9b69-45666922be35', '4d001a8b-d50c-45ff-8e14-ce12d931435e', 5, 76, 'Solo - A Star Wars Story', false);

insert into public.seasons (id, year, state, is_historical) values
  ('623ad8c3-e154-424f-888d-86d790ba3f65', 2019, 'ended', true);

insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values
  ('623ad8c3-e154-424f-888d-86d790ba3f65', '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf', 1, 159, 'The Lion King', true),
  ('623ad8c3-e154-424f-888d-86d790ba3f65', 'b405c38b-3ded-4d09-a654-32e77d5c2abe', 2, 159, 'The Lion King', true),
  ('623ad8c3-e154-424f-888d-86d790ba3f65', '45eed1fc-3a68-4b52-9535-8cdfc0079439', 4, 141, 'Frozen 2', false),
  ('623ad8c3-e154-424f-888d-86d790ba3f65', '23a3e068-2e1b-43d9-9c11-dd1c326b9529', 4, 141, 'The Lion King', true),
  ('623ad8c3-e154-424f-888d-86d790ba3f65', '4d001a8b-d50c-45ff-8e14-ce12d931435e', 7, 130, 'Captain Marvel', false),
  ('623ad8c3-e154-424f-888d-86d790ba3f65', '2f77b2e4-0618-4b02-995a-3b26c23d5a7c', 8, 127, 'Frozen 2', false),
  ('623ad8c3-e154-424f-888d-86d790ba3f65', 'd3c8ff43-8ded-46d4-b280-7f070b74cee7', 12, 109, 'Captain Marvel', false);

insert into public.seasons (id, year, state, is_historical) values
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', 2020, 'ended', true);

insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', '4d001a8b-d50c-45ff-8e14-ce12d931435e', 3, 41, 'Wonder Woman 1984', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', '23a3e068-2e1b-43d9-9c11-dd1c326b9529', 4, 41, 'Mulan', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', '2f77b2e4-0618-4b02-995a-3b26c23d5a7c', 5, 40, 'Wonder Woman 1984', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf', 7, 39, 'Wonder Woman 1984', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', 'b405c38b-3ded-4d09-a654-32e77d5c2abe', 7, 39, 'Wonder Woman 1984', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', 'f2669120-390c-4320-a80b-42222d0dfb8b', 14, 22, 'Black Widow', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', '45eed1fc-3a68-4b52-9535-8cdfc0079439', 15, 21, 'Black Widow', false),
  ('60702581-9ccb-4a08-ac69-695243a1e5b2', 'd3c8ff43-8ded-46d4-b280-7f070b74cee7', 15, 21, 'Ghostbusters Afterlife', false);

insert into public.seasons (id, year, state, is_historical) values
  ('e7d7f055-986a-4976-852f-1e82478a4c51', 2021, 'ended', true);

insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values
  ('e7d7f055-986a-4976-852f-1e82478a4c51', 'f2669120-390c-4320-a80b-42222d0dfb8b', 1, 124, 'Spider-Man: No Way Home', true),
  ('e7d7f055-986a-4976-852f-1e82478a4c51', '2f77b2e4-0618-4b02-995a-3b26c23d5a7c', 2, 118, 'Spider-Man: No Way Home', true),
  ('e7d7f055-986a-4976-852f-1e82478a4c51', '4d001a8b-d50c-45ff-8e14-ce12d931435e', 3, 110, 'Spider-Man: No Way Home', true),
  ('e7d7f055-986a-4976-852f-1e82478a4c51', 'b405c38b-3ded-4d09-a654-32e77d5c2abe', 4, 104, 'Spider-Man: No Way Home', true),
  ('e7d7f055-986a-4976-852f-1e82478a4c51', '23a3e068-2e1b-43d9-9c11-dd1c326b9529', 6, 79, 'The Matrix Resurrections', false),
  ('e7d7f055-986a-4976-852f-1e82478a4c51', '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf', 7, 77, 'The Matrix Resurrections', false),
  ('e7d7f055-986a-4976-852f-1e82478a4c51', '45eed1fc-3a68-4b52-9535-8cdfc0079439', 8, 65, 'Black Widow', false);

insert into public.seasons (id, year, state, is_historical) values
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', 2022, 'ended', true);

insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', '380b2d9a-a6dd-4d7a-a4d0-5783f4097309', 1, 135, 'Doctor Strange in the Multiverse of Madness', true),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', 'b405c38b-3ded-4d09-a654-32e77d5c2abe', 2, 127, 'Doctor Strange in the Multiverse of Madness', true),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', '45eed1fc-3a68-4b52-9535-8cdfc0079439', 3, 107, 'Avatar: The Way of Water', false),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf', 4, 99, 'Thor: Love and Thunder', false),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', '2f77b2e4-0618-4b02-995a-3b26c23d5a7c', 5, 96, 'Avatar: The Way of Water', false),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', '4d001a8b-d50c-45ff-8e14-ce12d931435e', 6, 84, 'Thor: Love and Thunder', false),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', 'f2669120-390c-4320-a80b-42222d0dfb8b', 7, 81, 'The Super Mario Bros. Movie', false),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', 'd28381bb-cb8b-4eb5-8efa-8b93141a9868', 9, 77, 'Avatar: The Way of Water', false),
  ('d381f32b-c5cf-4c0d-ac63-805ed2ff7c34', 'd3c8ff43-8ded-46d4-b280-7f070b74cee7', 10, 64, 'Black Panther: Wakanda Forever', false);

insert into public.seasons (id, year, state, is_historical) values
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', 2023, 'ended', true);

insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '380b2d9a-a6dd-4d7a-a4d0-5783f4097309', 1, 98, 'Spider-Man: Across the Spiderverse', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', 'f2669120-390c-4320-a80b-42222d0dfb8b', 2, 83, 'The Super Mario Bros. Movie', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '2f77b2e4-0618-4b02-995a-3b26c23d5a7c', 4, 77, 'Guardians of the Galaxy Vol. 3', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '23a3e068-2e1b-43d9-9c11-dd1c326b9529', 4, 77, 'The Super Mario Bros. Movie', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', 'd28381bb-cb8b-4eb5-8efa-8b93141a9868', 6, 76, 'Guardians of the Galaxy Vol. 3', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', 'b405c38b-3ded-4d09-a654-32e77d5c2abe', 6, 76, 'The Little Mermaid', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', 'd3c8ff43-8ded-46d4-b280-7f070b74cee7', 8, 75, 'Guardians of the Galaxy Vol. 3', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf', 9, 68, 'The Little Mermaid', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '4d001a8b-d50c-45ff-8e14-ce12d931435e', 10, 66, 'Mission: Impossible - Dead Reckoning Part 1', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '3560aa17-76b6-429f-b763-52a2e30a27d2', 10, 66, 'Fast X', false),
  ('4287da7b-7b97-4f0d-a14d-298e3e205da3', '45eed1fc-3a68-4b52-9535-8cdfc0079439', 13, 56, 'Ant-Man and the Wasp: Quantumania', false);

