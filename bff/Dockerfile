# Build from the repository root: docker build -f bff/Dockerfile .
FROM eclipse-temurin:21-jdk@sha256:db5cc6341a1d7bc40cdb51e1f0d9824f3bb2cc8107d29da421dc4df7d11f05f1 AS build
WORKDIR /src
COPY api/openapi.yaml api/
COPY bff/ bff/
WORKDIR /src/bff
# Without Git history the version falls back to 0.0.0-dev (see build.gradle.kts).
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar \
 && cp "$(find build/libs -name '*.jar' ! -name '*-plain.jar')" /app.jar

FROM eclipse-temurin:21-jre@sha256:ca73b4d3961703d6d7830a4361f49ef0478f8f28b39defc07bb72f4cc7f834f6
COPY --from=build /app.jar /app/app.jar
USER 1000
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
