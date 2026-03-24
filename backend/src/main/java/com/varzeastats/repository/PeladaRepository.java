package com.varzeastats.repository;

import com.varzeastats.entity.Pelada;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PeladaRepository extends JpaRepository<Pelada, Long> {

    List<Pelada> findAllByIdIn(Collection<Long> ids);
}
