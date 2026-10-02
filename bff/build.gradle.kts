plugins {
	kotlin("jvm") version "2.3.21"
	kotlin("plugin.spring") version "2.3.21"
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
	kotlin("plugin.jpa") version "2.3.21"
	id("org.openapi.generator") version "7.25.0"
}

group = "com.github"
// Derived from the latest v* tag, e.g. 0.1.0 on the tag, 0.1.0-3-gabc1234 after it.
version = runCatching {
	providers.exec {
		commandLine("git", "describe", "--tags", "--match", "v*", "--dirty")
		isIgnoreExitValue = true
	}.standardOutput.asText.get().trim().removePrefix("v")
}.getOrNull()?.ifEmpty { null } ?: "0.0.0-dev"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	runtimeOnly("org.flywaydb:flyway-database-postgresql")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

openApiGenerate {
	generatorName.set("spring")
	inputSpec.set(layout.projectDirectory.file("../api/openapi.yaml").asFile.absolutePath)
	outputDir.set(layout.buildDirectory.dir("generated/openapi").get().asFile.absolutePath)
	apiPackage.set("com.github.bff.generated.api")
	modelPackage.set("com.github.bff.generated.model")
	invokerPackage.set("com.github.bff.generated")
	configOptions.set(
		mapOf(
			"annotationLibrary" to "none",
			"documentationProvider" to "none",
			"generateJsonIncludeAnnotations" to "false",
			"generateJsonSetterNullsAnnotations" to "false",
			"hideGenerationTimestamp" to "true",
			"interfaceOnly" to "true",
			"openApiNullable" to "false",
			"skipDefaultInterface" to "true",
			"sourceFolder" to "src/main/java",
			"useBeanValidation" to "true",
			"useJspecify" to "true",
			"useResponseEntity" to "true",
			"useSpringBoot4" to "true",
			"useTags" to "true",
		),
	)
	globalProperties.set(
		mapOf(
			"apis" to "",
			"models" to "",
		),
	)
}

sourceSets {
	main {
		java {
			srcDir(layout.buildDirectory.dir("generated/openapi/src/main/java"))
		}
	}
}

// Compiler warnings fail the build so CI catches them, e.g. deprecated APIs in generated code.
tasks.withType<JavaCompile>().configureEach {
	options.compilerArgs.addAll(listOf("-Xlint:deprecation", "-Werror"))
}

tasks.named("compileKotlin") {
	dependsOn(tasks.named("openApiGenerate"))
}

kotlin {
	compilerOptions {
		allWarningsAsErrors = true
		freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
	}
}

allOpen {
	annotation("jakarta.persistence.Entity")
	annotation("jakarta.persistence.MappedSuperclass")
	annotation("jakarta.persistence.Embeddable")
}

tasks.withType<Test> {
	useJUnitPlatform()
}
