package com.varzeastats.repository;

import com.varzeastats.entity.Match;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchRepository extends JpaRepository<Match, Long> {

    List<Match> findAllByPelada_IdOrderByDateDesc(Long peladaId);

    Optional<Match> findFirstByPelada_IdAndFinishedAtIsNullOrderByIdDesc(Long peladaId);

    Optional<Match> findByIdAndPelada_Id(Long id, Long peladaId);
}
