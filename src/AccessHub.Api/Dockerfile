# syntax=docker/dockerfile:1
# Build from the repository root:  docker build -f src/AccessHub.Api/Dockerfile .

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, so this layer is reused until a project file or a package version changes.
COPY Directory.Build.props Directory.Packages.props ./
COPY src/AccessHub.Domain/AccessHub.Domain.csproj src/AccessHub.Domain/
COPY src/AccessHub.Application/AccessHub.Application.csproj src/AccessHub.Application/
COPY src/AccessHub.Infrastructure/AccessHub.Infrastructure.csproj src/AccessHub.Infrastructure/
COPY src/AccessHub.Api/AccessHub.Api.csproj src/AccessHub.Api/
RUN dotnet restore src/AccessHub.Api/AccessHub.Api.csproj

COPY src/ src/
RUN dotnet publish src/AccessHub.Api/AccessHub.Api.csproj -c Release -o /app --no-restore -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /app .
# The image's built-in non-root user.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "AccessHub.Api.dll"]
