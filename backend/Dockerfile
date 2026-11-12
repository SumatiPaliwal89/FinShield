FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q
COPY src src
RUN ./mvnw package -DskipTests && mv target/backend-*.jar target/app.jar

FROM eclipse-temurin:25-jdk
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
