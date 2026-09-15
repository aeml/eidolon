package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const AccountRoleAdmin = "admin"

type AccountRoleAssignment struct {
	GrantedAt time.Time `bson:"granted_at"`
	GrantedBy string    `bson:"granted_by"`
	Source    string    `bson:"source"`
}

func (db *DB) HasAdminRole(username string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var result struct {
		Roles map[string]AccountRoleAssignment `bson:"roles"`
	}
	err := db.users.FindOne(ctx, bson.M{"username": username},
		options.FindOne().SetProjection(bson.M{"roles.admin": 1})).Decode(&result)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	assignment, ok := result.Roles[AccountRoleAdmin]
	return ok && !assignment.GrantedAt.IsZero() && assignment.GrantedBy != "" && assignment.Source != "", nil
}

func (db *DB) GrantAdminRole(username, grantedBy, source string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	assignment := AccountRoleAssignment{
		GrantedAt: time.Now().UTC(),
		GrantedBy: grantedBy,
		Source:    source,
	}
	result, err := db.users.UpdateOne(ctx, bson.M{
		"username":    username,
		"roles.admin": bson.M{"$exists": false},
	}, bson.M{"$set": bson.M{"roles.admin": assignment}})
	if err != nil {
		return false, err
	}
	if result.ModifiedCount == 1 {
		return true, nil
	}

	hasRole, err := db.HasAdminRole(username)
	if err != nil {
		return false, err
	}
	if hasRole {
		return false, nil
	}
	return false, errors.New("user not found or admin role assignment is invalid")
}
