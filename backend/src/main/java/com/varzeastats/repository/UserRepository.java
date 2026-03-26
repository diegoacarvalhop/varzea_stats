package com.varzeastats.repository;

import com.varzeastats.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.pelada WHERE lower(u.email) = lower(:email)")
    Optional<User> findByEmailIgnoreCase(@Param("email") String email);

    @Query("select (count(u) > 0) from User u where lower(u.email) = lower(:email)")
    boolean existsByEmailIgnoreCase(@Param("email") String email);

    List<User> findAllByPelada_Id(Long peladaId, Sort sort);

    @Query(
            """
            select u from User u, UserPeladaMembership m
            where m.id.userId = u.id and m.id.peladaId = :peladaId
            order by lower(u.name), u.id
            """)
    List<User> findMembersByPeladaId(@Param("peladaId") Long peladaId);
}
