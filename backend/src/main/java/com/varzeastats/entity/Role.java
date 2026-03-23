package com.varzeastats.entity;

public enum Role {
    /** Acesso a todas as peladas; escolhe contexto via X-Pelada-Id; cria peladas. */
    ADMIN_GERAL,
    /** Administrador restrito à própria pelada (mesmas permissões operacionais, sem visão global). */
    ADMIN,
    SCOUT,
    PLAYER,
    MEDIA
}
