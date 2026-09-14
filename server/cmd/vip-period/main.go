// vip-period provisions trusted membership records, not payments or checkout.
package main

import (
	"context"
	"eidolon-server/internal/database"
	"flag"
	"fmt"
	"log"
	"os"
	"time"
)

func main() {
	username := flag.String("username", "", "existing account username")
	start := flag.String("start", "", "membership month start (RFC3339)")
	end := flag.String("end", "", "membership month end (RFC3339, exclusive)")
	revoke := flag.String("revoke", "", "revoke this existing period ID instead of provisioning")
	apply := flag.Bool("apply", false, "perform the administrative write; otherwise preview only")
	flag.Parse()
	if *username == "" {
		log.Fatal("--username is required")
	}
	var period database.VIPPeriod
	if *revoke == "" {
		from, err := time.Parse(time.RFC3339, *start)
		if err != nil {
			log.Fatal("invalid --start")
		}
		until, err := time.Parse(time.RFC3339, *end)
		if err != nil {
			log.Fatal("invalid --end")
		}
		period, err = database.NewVIPPeriod(from, until)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Account %s: VIP %s to %s; one %d EP allowance. Period %s.\n", *username, period.StartsAt.Format(time.RFC3339), period.EndsAt.Format(time.RFC3339), database.VIPMonthlyEP, period.ID)
	} else {
		fmt.Printf("Revoke VIP period %s for %s; already-issued EP is unchanged.\n", *revoke, *username)
	}
	if !*apply {
		fmt.Println("Preview only. No database connection or change; use --apply to provision/revoke.")
		return
	}
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		log.Fatal("MONGO_URI is required; do not pass credentials on the command line")
	}
	db, err := database.New(uri)
	if err != nil {
		log.Fatal("database connection failed")
	}
	defer db.Close(context.Background())
	if *revoke != "" {
		if err := db.RevokeVIPPeriod(*username, *revoke); err != nil {
			log.Fatal(err)
		}
		fmt.Println("Membership period revoked.")
		return
	}
	created, err := db.ProvisionVIPPeriod(*username, period)
	if err != nil {
		log.Fatal(err)
	}
	if created {
		fmt.Println("Membership month recorded; allowance is delivered on next login/wallet refresh.")
	} else {
		fmt.Println("Membership month already recorded; no duplicate grant.")
	}
}
