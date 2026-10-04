package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"eidolon-server/internal/database"
)

type emailRecoveryStore interface {
	BeginRecoveryEmail(string, string, string, string, time.Time) (bool, error)
	ConfirmRecoveryEmail(string, string, time.Time) (bool, error)
	BeginPasswordRecovery(string, string, time.Time) (string, error)
	CompletePasswordRecovery(string, string, string, time.Time) (bool, bool, error)
	RecoveryNotificationAddress(string) (string, error)
}

type recoveryMailJob struct {
	username, recipient, kind, token string
}

type emailRecoveryService struct {
	store  emailRecoveryStore
	mailer *recoveryMailer
	queue  chan recoveryMailJob
	ctx    context.Context
}

var accountRecovery *emailRecoveryService

func newEmailRecoveryService(store emailRecoveryStore, mailer *recoveryMailer, loops *serverLoops) *emailRecoveryService {
	if store == nil || mailer == nil {
		return nil
	}
	s := &emailRecoveryService{store: store, mailer: mailer, queue: make(chan recoveryMailJob, 32), ctx: loops.ctx}
	// Fixed workers/queue: requests acknowledge before any account lookup and
	// never launch one goroutine per email. Tokens exist only in bounded RAM.
	for range 2 {
		loops.wg.Add(1)
		go func() {
			defer loops.wg.Done()
			for {
				select {
				case <-s.ctx.Done():
					return
				case job := <-s.queue:
					if s.ctx.Err() != nil {
						return
					}
					s.deliver(job)
				}
			}
		}()
	}
	return s
}

func (s *emailRecoveryService) enqueue(job recoveryMailJob) bool {
	if s == nil || s.ctx.Err() != nil {
		return false
	}
	select {
	case s.queue <- job:
		return true
	default:
		return false
	}
}

func (s *emailRecoveryService) deliver(job recoveryMailJob) {
	if job.kind == "request" {
		token, err := generateResumeToken()
		if err != nil {
			log.Print("Recovery mail request could not be prepared")
			return
		}
		unlock := lockCharacterWork(job.username)
		address, err := s.store.BeginPasswordRecovery(job.username, token, time.Now())
		unlock()
		if err != nil {
			log.Print("Recovery mail storage was not confirmed")
			return
		}
		if address == "" {
			return
		} // Unknown/unverified/cooldown: public reply was identical.
		job.recipient, job.token, job.kind = address, token, "reset"
	}
	subject := "Eidolon account recovery"
	text := "Your Eidolon password was reset. Existing sessions were invalidated. Sign in at https://play.eidolonrealms.com/ with your new password. If you did not request this, contact account support."
	if job.kind != "notice" {
		link, err := recoveryLink(job.kind, job.username, job.token)
		if err != nil {
			log.Print("Recovery mail request could not be prepared")
			return
		}
		if job.kind == "verify" {
			subject = "Verify your Eidolon recovery email"
			text = "A signed-in account owner requested this recovery address. To confirm it within 30 minutes, open this link and choose Confirm email:\n\n" + link + "\n\nIf you did not request this, ignore this message. Your address is not verified until you confirm."
		} else {
			text = "To reset your Eidolon password within 15 minutes, open this link and choose a new password:\n\n" + link + "\n\nIf you did not request this, ignore this message. This request has not changed your password or signed you out."
		}
	}
	if err := s.mailer.send(s.ctx, job.recipient, subject, text); err != nil {
		// No usernames, recipient lists, API headers, links or provider bodies.
		log.Print("Recovery email delivery was not confirmed; recipient may retry")
	}
}

type emailRecoveryPayload struct {
	RequestID       string `json:"requestId"`
	Username        string `json:"username"`
	Email           string `json:"email"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
	Token           string `json:"token"`
}

func sendEmailRecoveryResult(c *Client, msg Message, id string, success bool, message string) {
	payload, _ := json.Marshal(struct {
		RequestID string `json:"requestId"`
		Action    string `json:"action"`
		Success   bool   `json:"success"`
		Message   string `json:"message"`
	}{id, msg.Type, success, message})
	c.sendSafe(createMessage("email_recovery_result", payload))
}

func handleEmailRecovery(c *Client, msg Message) {
	var p emailRecoveryPayload
	if json.Unmarshal(msg.Payload, &p) != nil || !reportRequestIDPattern.MatchString(p.RequestID) {
		c.sendError("Invalid account recovery request.")
		return
	}
	reply := func(ok bool, message string) { sendEmailRecoveryResult(c, msg, p.RequestID, ok, message) }
	if c.transportClosed.Load() || c.retired.Load() {
		return
	}
	if accountRecovery == nil {
		reply(false, "Email recovery is not configured on this server.")
		return
	}
	if msg.Type == MsgSetRecoveryEmail {
		// Dispatch owns the authenticated account-work lock. Never use a supplied account name.
		if c.username == "" || !currentCharacterConnection(c) {
			reply(false, "Sign in before setting your recovery address.")
			return
		}
		if !database.ValidRecoveryEmail(p.Email) || len(p.CurrentPassword) == 0 || len(p.CurrentPassword) > 72 {
			reply(false, "Enter one email address and your current password.")
			return
		}
		p.Username = c.username
	} else {
		// A public link uses a fresh signed-out socket. This prevents nested
		// cross-account locks and changing another account from a live character.
		if c.username != "" {
			reply(false, "Sign out before using an account recovery link.")
			return
		}
		if p.Username == "" || len(p.Username) > 128 {
			reply(false, "Enter your account username.")
			return
		}
	}
	done, err := credentialAdmission.begin(msg.Type, p.Username, time.Now())
	if err != nil {
		reply(false, err.Error())
		return
	}
	defer done()
	if msg.Type == MsgRequestPasswordRecovery {
		if !accountRecovery.enqueue(recoveryMailJob{username: p.Username, kind: "request"}) {
			reply(false, "Account service is busy. Please retry shortly.")
			return
		}
		reply(true, "If this account has a verified recovery address, a link will be requested. Check your mailbox and spam folder; wait at least a minute before trying again.")
		return
	}
	if msg.Type == MsgSetRecoveryEmail {
		token, err := generateResumeToken()
		if err != nil {
			reply(false, "Verification request could not be prepared.")
			return
		}
		changed, err := accountRecovery.store.BeginRecoveryEmail(c.username, p.CurrentPassword, p.Email, token, time.Now())
		if err != nil {
			reply(false, "Verification request was not confirmed. Retry in a minute.")
			return
		}
		if !changed {
			reply(false, "Check your current password, or wait a minute before requesting another link.")
			return
		}
		if !accountRecovery.enqueue(recoveryMailJob{username: c.username, recipient: p.Email, token: token, kind: "verify"}) {
			reply(false, "Mail service is busy. Retry in a minute.")
			return
		}
		reply(true, "Verification email requested. Open its link and explicitly confirm your address within30 minutes. Mailbox delivery is not guaranteed.")
		return
	}
	if _, err := recoveryLink("reset", p.Username, p.Token); err != nil {
		reply(false, "This link is invalid or expired. Request a new one.")
		return
	}
	if msg.Type == MsgCompletePasswordRecovery {
		if err := validateNewPassword(p.Username, p.NewPassword); err != nil {
			reply(false, err.Error())
			return
		}
	}
	unlock := lockCharacterWork(p.Username)
	defer unlock()
	if msg.Type == MsgConfirmRecoveryEmail {
		changed, err := accountRecovery.store.ConfirmRecoveryEmail(p.Username, p.Token, time.Now())
		if err != nil {
			reply(false, "Email confirmation was not confirmed. Try the link again before requesting another.")
			return
		}
		if !changed {
			reply(false, "This link is invalid or expired. Request a new one.")
			return
		}
		reply(true, "Recovery email verified. Sign in normally; this link did not sign you in.")
		return
	}
	if msg.Type != MsgCompletePasswordRecovery {
		reply(false, "Invalid account recovery action.")
		return
	}
	changed, attempted, err := accountRecovery.store.CompletePasswordRecovery(p.Username, p.Token, p.NewPassword, time.Now())
	if changed || attempted && err != nil {
		revokeAccountResumeToken(p.Username)
		sessionsMu.Lock()
		previous := activeSessions[p.Username]
		sessionsMu.Unlock()
		if previous != nil {
			cleanupClientLocked(previous)
			previous.retired.Store(true)
			previous.sendError("Account recovery requires signing in again.")
			if previous.conn != nil {
				_ = previous.conn.Close()
			}
		}
	}
	if err != nil {
		reply(false, "Reset was not confirmed. The server may have saved it; try signing in with the new password before retrying. No automatic retry is sent.")
		return
	}
	if !changed {
		reply(false, "This link is invalid or expired. Request a new one.")
		return
	}
	// Notification failure cannot reverse a committed password change.
	if address, err := accountRecovery.store.RecoveryNotificationAddress(p.Username); err == nil && address != "" {
		if !accountRecovery.enqueue(recoveryMailJob{username: p.Username, recipient: address, kind: "notice"}) {
			log.Print("Recovery notification queue is full")
		}
	} else {
		log.Print("Recovery notification address was not confirmed")
	}
	reply(true, "Password reset. Existing sessions were invalidated. Sign in normally with your new password.")
}
