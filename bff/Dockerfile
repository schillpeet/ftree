# Build from the repository root: docker build -f bff/Dockerfile .
FROM eclipse-temurin:21-jdk@sha256:8ad118b146aa92da815b576441acd6b42b38236797ad0b6edc8c200b85bb0734 AS build
WORKDIR /src
COPY api/openapi.yaml api/
COPY bff/ bff/
WORKDIR /src/bff
# Without Git history the version falls back to 0.0.0-dev (see build.gradle.kts).
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar \
 && cp "$(find build/libs -name '*.jar' ! -name '*-plain.jar')" /app.jar

FROM eclipse-temurin:21-jre@sha256:d77e090ae1f6970c047b443c6f0a6c1358b0426d44432bb5a7753408cd43de0d
COPY --from=build /app.jar /app/app.jar
USER 1000
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
