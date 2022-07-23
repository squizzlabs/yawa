CREATE TABLE `cities` (
  `id` int NOT NULL,
  `state_abbr` varchar(2) NOT NULL,
  `state_name` varchar(24) NOT NULL,
  `city` varchar(64) NOT NULL,
  `county` varchar(64) NOT NULL,
  `lat` decimal(8,2) NOT NULL,
  `lon` decimal(8,2) NOT NULL,
  key idx1 (city)
);
