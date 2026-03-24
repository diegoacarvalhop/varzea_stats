package com.varzeastats.repository;

import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.entity.UserPeladaId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserPeladaMembershipRepository extends JpaRepository<UserPeladaMembership, UserPeladaId> {

    List<UserPeladaMembership> findById_UserId(Long userId);

    List<UserPeladaMembership> findById_PeladaId(Long peladaId);

    void deleteById_UserId(Long userId);

    boolean existsById_UserIdAndId_PeladaId(Long userId, Long peladaId);

    @Query("select count(m) from UserPeladaMembership m where m.id.peladaId = :pid")
    long countByPeladaId(@Param("pid") Long peladaId);
}
