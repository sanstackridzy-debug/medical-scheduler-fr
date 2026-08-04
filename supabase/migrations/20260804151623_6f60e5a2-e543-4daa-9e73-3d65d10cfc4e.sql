-- Seed sample staff skills for the smart scheduler
-- Inserted idempotently based on the unique (user_id, skill_id) constraint.

INSERT INTO public.staff_skills (user_id, skill_id) VALUES
  -- Ward Care: all nurses
  ('e87de89f-ad08-4ca1-be94-d4da201d1fa9', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('87687fb7-38c6-4c4b-9a3c-ee61cb64f26e', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('e7590d5a-cf35-4e67-946c-3be32b30ddb4', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('e5ea833e-1518-46a7-9f77-fe1c5bab8bd0', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('1c5ef3e6-98d3-4c3d-82d9-2d1311aa7496', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('64783d72-8018-4773-85e2-5053557cd10c', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('1f583616-c473-47f0-a2c5-7f7ae3f5d8d9', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('e89159e9-e175-43fd-8b8a-a9d0fde87b7d', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('c82e28da-9dd3-4a00-be78-be9f312374f4', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('a75febbd-cb18-496f-ad0c-1d04c1538eb7', '2b31d9fa-666f-48fd-aae9-2e174719f864'),

  -- Ward Care: some doctors
  ('7b1532bf-03e6-4f23-b64c-d93c2ca860c0', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('ba58918c-2666-4126-b6de-0c71f667410e', '2b31d9fa-666f-48fd-aae9-2e174719f864'),
  ('c8fd7716-935a-4f86-9736-1b8c5cb183a7', '2b31d9fa-666f-48fd-aae9-2e174719f864'),

  -- OPD: doctors
  ('7b1532bf-03e6-4f23-b64c-d93c2ca860c0', 'b7ea6bd9-9f12-49fd-a5ad-5860407db710'),
  ('518c23d2-0351-46ba-b43a-357b2298c52b', 'b7ea6bd9-9f12-49fd-a5ad-5860407db710'),
  ('20048981-c5a9-4db9-a631-1a8ea43b5a49', 'b7ea6bd9-9f12-49fd-a5ad-5860407db710'),
  ('6ef3eb65-41b0-4a9d-a0bf-802f8766c65a', 'b7ea6bd9-9f12-49fd-a5ad-5860407db710'),
  ('c8fd7716-935a-4f86-9736-1b8c5cb183a7', 'b7ea6bd9-9f12-49fd-a5ad-5860407db710'),

  -- Surgery: doctors
  ('7b1532bf-03e6-4f23-b64c-d93c2ca860c0', 'a37263b0-6bf7-4742-96e3-682fd494d6f5'),
  ('518c23d2-0351-46ba-b43a-357b2298c52b', 'a37263b0-6bf7-4742-96e3-682fd494d6f5'),
  ('ba58918c-2666-4126-b6de-0c71f667410e', 'a37263b0-6bf7-4742-96e3-682fd494d6f5'),
  ('c8fd7716-935a-4f86-9736-1b8c5cb183a7', 'a37263b0-6bf7-4742-96e3-682fd494d6f5'),

  -- ER Trauma: doctors and nurses
  ('7b1532bf-03e6-4f23-b64c-d93c2ca860c0', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('518c23d2-0351-46ba-b43a-357b2298c52b', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('20048981-c5a9-4db9-a631-1a8ea43b5a49', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('ba58918c-2666-4126-b6de-0c71f667410e', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('e87de89f-ad08-4ca1-be94-d4da201d1fa9', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('e7590d5a-cf35-4e67-946c-3be32b30ddb4', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('e5ea833e-1518-46a7-9f77-fe1c5bab8bd0', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('1f583616-c473-47f0-a2c5-7f7ae3f5d8d9', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),
  ('c82e28da-9dd3-4a00-be78-be9f312374f4', 'c8b92682-c1f0-4b96-8a84-9094fa81de9c'),

  -- ACLS (also required for ER Trauma)
  ('7b1532bf-03e6-4f23-b64c-d93c2ca860c0', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('518c23d2-0351-46ba-b43a-357b2298c52b', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('20048981-c5a9-4db9-a631-1a8ea43b5a49', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('ba58918c-2666-4126-b6de-0c71f667410e', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('e87de89f-ad08-4ca1-be94-d4da201d1fa9', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('e7590d5a-cf35-4e67-946c-3be32b30ddb4', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('e5ea833e-1518-46a7-9f77-fe1c5bab8bd0', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('1f583616-c473-47f0-a2c5-7f7ae3f5d8d9', '30905f35-f864-4583-882d-da7e5e28e848'),
  ('c82e28da-9dd3-4a00-be78-be9f312374f4', '30905f35-f864-4583-882d-da7e5e28e848')
ON CONFLICT (user_id, skill_id) DO NOTHING;
