-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : sam. 30 mai 2026 à 08:45
-- Version du serveur : 12.0.2-MariaDB-log
-- Version de PHP : 8.3.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `scanr`
--

-- --------------------------------------------------------

--
-- Structure de la table `scanr_person`
--

CREATE TABLE `scanr_person` (
  `id` varchar(255) NOT NULL COMMENT 'Identifiant scanR (ex: idref/123456)',
  `fullName` varchar(512) DEFAULT NULL,
  `data` longtext DEFAULT NULL COMMENT 'JSON brut de l''enregistrement complet',
  `imported_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Dump scanR importé depuis persons_denormalized.jsonl.gz';

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `scanr_person`
--
ALTER TABLE `scanr_person`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fullName` (`fullName`(100));
ALTER TABLE `scanr_person` ADD FULLTEXT KEY `ft_person_search` (`fullName`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
