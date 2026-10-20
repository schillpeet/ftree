# Build from the repository root: docker build -f bff/Dockerfile .
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY api/openapi.yaml api/
COPY bff/ bff/
WORKDIR /src/bff
# Without Git history the version falls back to 0.0.0-dev (see build.gradle.kts).
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar \
 && cp "$(find build/libs -name '*.jar' ! -name '*-plain.jar')" /app.jar

FROM eclipse-temurin:21-jre
COPY --from=build /app.jar /app/app.jar
USER 1000
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
