package com.varzeastats.repository;

import com.varzeastats.entity.Media;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<Media, Long> {

    List<Media> findByMatch_IdOrderByIdDesc(Long matchId);
}
