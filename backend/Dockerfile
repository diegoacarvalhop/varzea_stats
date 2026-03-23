# Build da API (Gradle) + imagem JRE 17
# Imagens *-alpine do Temurin costumam ser só amd64; usamos a base Debian/Ubuntu (multi-arch: arm64 + amd64).
FROM eclipse-temurin:17-jdk AS builder
WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
COPY src src

RUN chmod +x gradlew \
    && ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
