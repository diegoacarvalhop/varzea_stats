package com.varzeastats.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${varzea.mail.from:noreply@varzea.com}")
    private String mailFrom;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void enviarEmailRedefinicaoSenha(String destinatario, String linkRedefinicao) {
        String assunto = "VARzea Stats — Redefinição de senha";
        String texto =
                "Você solicitou a redefinição de senha. Acesse o link abaixo (válido por 1 hora):\n\n"
                        + linkRedefinicao
                        + "\n\nSe não foi você, ignore este e-mail.";
        if (mailHost != null && !mailHost.isBlank() && mailSender != null) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setTo(destinatario);
                msg.setSubject(assunto);
                msg.setText(texto);
                msg.setFrom(mailFrom);
                mailSender.send(msg);
                log.info("E-mail de redefinição de senha enviado para {}", destinatario);
            } catch (Exception e) {
                log.warn("Falha ao enviar e-mail de redefinição; link registrado no log. Erro: {}", e.getMessage());
                log.info("Link de redefinição para {}: {}", destinatario, linkRedefinicao);
            }
        } else {
            log.warn(
                    "SMTP não configurado (defina SPRING_MAIL_HOST etc.). Link de redefinição para {}: {}",
                    destinatario,
                    linkRedefinicao);
        }
    }

    @Async
    public void enviarEmailCobrancaMensalidade(
            String destinatario,
            String nomeJogador,
            String nomePelada,
            LocalDate referenciaMes,
            Integer valorMensalidadeCents) {
        DateTimeFormatter mesFmt = DateTimeFormatter.ofPattern("MMMM 'de' yyyy", new Locale("pt", "BR"));
        String mesRef = referenciaMes.format(mesFmt);
        String valorTxt = valorMensalidadeCents != null && valorMensalidadeCents > 0
                ? String.format("R$ %.2f", valorMensalidadeCents / 100.0).replace('.', ',')
                : "valor conforme combinado com a diretoria da pelada";
        String assunto = "VARzea Stats — Cobrança de mensalidade em atraso";
        String texto =
                "Olá, "
                        + nomeJogador
                        + "!\n\n"
                        + "Identificamos mensalidade(s) em atraso na pelada "
                        + nomePelada
                        + ".\n"
                        + "Referência principal: "
                        + mesRef
                        + ".\n"
                        + "Valor: "
                        + valorTxt
                        + ".\n\n"
                        + "Por favor, regularize o pagamento o quanto antes.\n"
                        + "Se você já pagou recentemente, desconsidere esta mensagem.\n\n"
                        + "Equipe VARzea Stats";
        enviarEmail(destinatario, assunto, texto);
    }

    private void enviarEmail(String destinatario, String assunto, String texto) {
        if (mailHost != null && !mailHost.isBlank() && mailSender != null) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setTo(destinatario);
                msg.setSubject(assunto);
                msg.setText(texto);
                msg.setFrom(mailFrom);
                mailSender.send(msg);
                log.info("E-mail enviado para {} com assunto '{}'", destinatario, assunto);
            } catch (Exception e) {
                log.warn("Falha ao enviar e-mail; conteúdo registrado no log. Erro: {}", e.getMessage());
                log.info("E-mail para {} | Assunto: {} | Texto: {}", destinatario, assunto, texto);
            }
        } else {
            log.warn(
                    "SMTP não configurado (defina SPRING_MAIL_HOST etc.). E-mail não enviado para {} | Assunto: {}",
                    destinatario,
                    assunto);
            log.debug("Corpo do e-mail (não enviado): {}", texto);
        }
    }
}
