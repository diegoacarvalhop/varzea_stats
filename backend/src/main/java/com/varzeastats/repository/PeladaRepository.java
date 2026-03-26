package com.varzeastats.repository;

import com.varzeastats.entity.Pelada;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PeladaRepository extends JpaRepository<Pelada, Long> {

    List<Pelada> findAllByIdIn(Collection<Long> ids);

    /** Mesmo nome após trim e ignorando maiúsculas/minúsculas. */
    @Query(
            value = "SELECT EXISTS(SELECT 1 FROM peladas p WHERE lower(trim(p.name)) = lower(trim(:name)))",
            nativeQuery = true)
    boolean existsByNameEqualNormalized(@Param("name") String name);
}
