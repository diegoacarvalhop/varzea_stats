package com.varzeastats.service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@Slf4j
public class PaymentReceiptStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            MediaType.IMAGE_JPEG_VALUE,
            "image/jpg",
            MediaType.IMAGE_GIF_VALUE,
            "image/webp");
    private static final long MAX_BYTES = 8L * 1024 * 1024;

    private final Path uploadDir;

    public PaymentReceiptStorageService(
            @Value("${varzea.payment-receipt.upload-dir}") String uploadDirProp) {
        this.uploadDir = Path.of(uploadDirProp).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() {
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível criar diretório de comprovantes: " + uploadDir, e);
        }
    }

    public StoredFile store(long peladaId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Comprovante vazio.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Comprovante muito grande (máximo 8 MB).");
        }
        String ct = file.getContentType();
        if (ct == null || !ALLOWED_TYPES.contains(ct.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Formato não permitido. Use PDF, PNG, JPEG, GIF ou WebP.");
        }
        validateMagicBytes(file, ct);
        String ext = extensionForContentType(ct);
        String storedName = "pelada-" + peladaId + "-receipt-" + UUID.randomUUID() + ext;
        Path target = uploadDir.resolve(storedName).normalize();
        if (!target.startsWith(uploadDir)) {
            throw new IllegalStateException("Path inválido.");
        }
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.warn("Falha ao gravar comprovante da pelada {}", peladaId, e);
            throw new IllegalArgumentException("Não foi possível salvar o comprovante.");
        }
        return new StoredFile(storedName, ct, file.getSize(), file.getOriginalFilename());
    }

    private static void validateMagicBytes(MultipartFile file, String contentType) {
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(12);
            String ct = contentType.toLowerCase(Locale.ROOT);
            boolean ok;
            if (ct.contains("pdf")) {
                ok = header.length >= 4
                        && header[0] == 0x25
                        && header[1] == 0x50
                        && header[2] == 0x44
                        && header[3] == 0x46;
            } else if (ct.contains("png")) {
                ok = header.length >= 8
                        && (header[0] & 0xFF) == 0x89
                        && header[1] == 0x50
                        && header[2] == 0x4E
                        && header[3] == 0x47;
            } else if (ct.contains("jpeg") || ct.contains("jpg")) {
                ok = header.length >= 3
                        && (header[0] & 0xFF) == 0xFF
                        && (header[1] & 0xFF) == 0xD8
                        && (header[2] & 0xFF) == 0xFF;
            } else if (ct.contains("gif")) {
                ok = header.length >= 6
                        && header[0] == 0x47
                        && header[1] == 0x49
                        && header[2] == 0x46;
            } else if (ct.contains("webp")) {
                ok = header.length >= 12
                        && header[0] == 0x52
                        && header[1] == 0x49
                        && header[2] == 0x46
                        && header[3] == 0x46
                        && header[8] == 0x57
                        && header[9] == 0x45
                        && header[10] == 0x42
                        && header[11] == 0x50;
            } else {
                ok = false;
            }
            if (!ok) {
                throw new IllegalArgumentException("Conteúdo do comprovante inválido para o formato informado.");
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("Não foi possível validar o comprovante.");
        }
    }

    public record LoadedFile(Resource resource, String contentType) {}

    public record StoredFile(String storedName, String contentType, long sizeBytes, String originalFilename) {}

    public Optional<LoadedFile> load(String storedName) {
        if (storedName == null || storedName.isBlank()) return Optional.empty();
        if (storedName.contains("..") || storedName.contains("/") || storedName.contains("\\")) return Optional.empty();
        Path target = uploadDir.resolve(storedName).normalize();
        if (!target.startsWith(uploadDir) || !Files.isRegularFile(target)) return Optional.empty();
        try {
            Resource resource = new UrlResource(target.toUri());
            if (!resource.exists() || !resource.isReadable()) return Optional.empty();
            String ct = Files.probeContentType(target);
            return Optional.of(new LoadedFile(resource, ct != null ? ct : MediaType.APPLICATION_OCTET_STREAM_VALUE));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static String extensionForContentType(String contentType) {
        String ct = contentType.toLowerCase(Locale.ROOT);
        if (ct.contains("pdf")) return ".pdf";
        if (ct.contains("png")) return ".png";
        if (ct.contains("jpeg") || ct.contains("jpg")) return ".jpg";
        if (ct.contains("gif")) return ".gif";
        if (ct.contains("webp")) return ".webp";
        return ".bin";
    }
}
