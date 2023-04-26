CREATE TABLE `cities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `state_abbr` varchar(2) NOT NULL,
  `state_name` varchar(24) NOT NULL,
  `city` varchar(64) NOT NULL,
  `county` varchar(64) NOT NULL,
  `lat` decimal(8,2) NOT NULL,
  `lon` decimal(8,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `state_abbr` (`state_abbr`,`city`,`county`,`lat`,`lon`),
  KEY `city` (`city`),
  KEY `city_state` (`city`,`state_name`)
);