# Build from the repository root: docker build -f bff/Dockerfile .
FROM eclipse-temurin:21-jdk@sha256:ebfbb18d11ff163ee83b21258acf12248af48d22a0fdfdc68fa1a1516c05976a AS build
WORKDIR /src
COPY api/openapi.yaml api/
COPY bff/ bff/
WORKDIR /src/bff
# Without Git history the version falls back to 0.0.0-dev (see build.gradle.kts).
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar \
 && cp "$(find build/libs -name '*.jar' ! -name '*-plain.jar')" /app.jar

FROM eclipse-temurin:21-jre@sha256:0b99b3376fbb50dbf9c0af8535fdd5b8eb0d3fdfc8b1e4967f383b6919f6901a
COPY --from=build /app.jar /app/app.jar
USER 1000
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
