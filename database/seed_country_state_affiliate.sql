-- Seed data for db_affiliate: India and its states / union territories.
-- Same ids as database/seed_country_state.sql (db_shopping) so both databases agree: cid 96 = India.
-- public.country / public.state were migrated without rows. Safe to run more than once.
--
--   psql -h 127.0.0.1 -U postgres -d db_affiliate -f database/seed_country_state_affiliate.sql

begin;

insert into public.country (cid, countryname, cactive, isdcode, currencyname, currencysymbol, currencycode, currencyicon)
overriding system value
values (96, 'India', true, '+91', 'Indian Rupee', '₹', 'INR', '')
on conflict (cid) do nothing;

-- keep the identity sequence ahead of the explicit id
select setval(pg_get_serial_sequence('public.country', 'cid'), greatest((select max(cid) from public.country), 1));

insert into public.state (sid, cid, statename, scode, sactive) values
  ( 1, 96, 'Andaman and Nicobar Islands',              'AN', true),
  ( 2, 96, 'Andhra Pradesh',                           'AP', true),
  ( 3, 96, 'Arunachal Pradesh',                        'AR', true),
  ( 4, 96, 'Assam',                                    'AS', true),
  ( 5, 96, 'Bihar',                                    'BR', true),
  ( 6, 96, 'Chandigarh',                               'CH', true),
  ( 7, 96, 'Chhattisgarh',                             'CG', true),
  ( 8, 96, 'Dadra and Nagar Haveli and Daman and Diu', 'DH', true),
  ( 9, 96, 'Delhi',                                    'DL', true),
  (10, 96, 'Goa',                                      'GA', true),
  (11, 96, 'Gujarat',                                  'GJ', true),
  (12, 96, 'Haryana',                                  'HR', true),
  (13, 96, 'Himachal Pradesh',                         'HP', true),
  (14, 96, 'Jammu and Kashmir',                        'JK', true),
  (15, 96, 'Jharkhand',                                'JH', true),
  (16, 96, 'Karnataka',                                'KA', true),
  (17, 96, 'Kerala',                                   'KL', true),
  (18, 96, 'Ladakh',                                   'LA', true),
  (19, 96, 'Lakshadweep',                              'LD', true),
  (20, 96, 'Madhya Pradesh',                           'MP', true),
  (21, 96, 'Maharashtra',                              'MH', true),
  (22, 96, 'Manipur',                                  'MN', true),
  (23, 96, 'Meghalaya',                                'ML', true),
  (24, 96, 'Mizoram',                                  'MZ', true),
  (25, 96, 'Nagaland',                                 'NL', true),
  (26, 96, 'Odisha',                                   'OD', true),
  (27, 96, 'Puducherry',                               'PY', true),
  (28, 96, 'Punjab',                                   'PB', true),
  (29, 96, 'Rajasthan',                                'RJ', true),
  (30, 96, 'Sikkim',                                   'SK', true),
  (31, 96, 'Tamil Nadu',                               'TN', true),
  (32, 96, 'Telangana',                                'TS', true),
  (33, 96, 'Tripura',                                  'TR', true),
  (34, 96, 'Uttar Pradesh',                            'UP', true),
  (35, 96, 'Uttarakhand',                              'UK', true),
  (36, 96, 'West Bengal',                              'WB', true)
on conflict (sid) do nothing;

commit;
