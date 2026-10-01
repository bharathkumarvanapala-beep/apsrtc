INSERT INTO buses (bus_number, registration_number, bus_type)
VALUES
('302','DEMO-302','Demo Bus'),
('415','DEMO-415','Demo Bus'),
('518','DEMO-518','Demo Bus'),
('627','DEMO-627','Demo Bus')
ON CONFLICT (bus_number) DO NOTHING;

INSERT INTO routes (route_name, origin, destination)
VALUES ('Paderu - Visakhapatnam','Paderu','Visakhapatnam')
ON CONFLICT DO NOTHING;
