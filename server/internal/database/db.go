package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

type DB struct {
	client *mongo.Client
	users  *mongo.Collection
}

type User struct {
	Username     string       `bson:"username"`
	Email        string       `bson:"email"`
	PasswordHash string       `bson:"password_hash"`
	CreatedAt    time.Time    `bson:"created_at"`
	Characters   []*Character `bson:"characters"`
}

type Character struct {
	Name      string          `bson:"name"`
	Class     string          `bson:"class"` // Fighter, Wizard, etc.
	Level     int             `bson:"level"`
	XP        int             `bson:"xp"`
	Gold      int             `bson:"gold"`
	X         float64         `bson:"x"`
	Y         float64         `bson:"y"`
	Z         float64         `bson:"z"`
	Stats     Stats           `bson:"stats"`
	Inventory []Item          `bson:"inventory"`
	Equipment map[string]Item `bson:"equipment"`
}

type Stats struct {
	Strength     int `bson:"strength"`
	Dexterity    int `bson:"dexterity"`
	Intelligence int `bson:"intelligence"`
	Wisdom       int `bson:"wisdom"`
	Vitality     int `bson:"vitality"`
}

type Item struct {
	ID          string         `bson:"id"`
	Name        string         `bson:"name"`
	Type        string         `bson:"type"` // WEAPON, ARMOR
	Slot        string         `bson:"slot"`
	Rarity      string         `bson:"rarity"`
	Level       int            `bson:"level"`
	Stats       map[string]int `bson:"stats"`
	Value       int            `bson:"value"`
	Icon        string         `bson:"icon"`
	Description string         `bson:"description"`
}

func New(uri string) (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	// Ping the database
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	db := client.Database("eidolon")
	users := db.Collection("users")

	// Create unique index on username
	_, err = users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "username", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return nil, err
	}

	return &DB{
		client: client,
		users:  users,
	}, nil
}

func (db *DB) CreateUser(username, email, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.users.InsertOne(ctx, user)
	if mongo.IsDuplicateKeyError(err) {
		return errors.New("username already exists")
	}
	return err
}

func (db *DB) Authenticate(username, password string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user User
	err := db.users.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return false, nil
	}

	return true, nil
}

func (db *DB) CreateCharacter(username string, char *Character) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"username": username}
	update := bson.M{"$push": bson.M{"characters": char}}

	result, err := db.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (db *DB) GetCharacter(username, charName string) (*Character, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user User
	// Projection to fetch only the specific character would be better, but for now fetch user
	err := db.users.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		return nil, err
	}

	for _, c := range user.Characters {
		if c.Name == charName {
			return c, nil
		}
	}
	return nil, errors.New("character not found")
}

func (db *DB) GetUser(username string) (*User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user User
	err := db.users.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) SaveCharacter(username string, char *Character) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Update specific character in the array
	filter := bson.M{
		"username":        username,
		"characters.name": char.Name,
	}
	update := bson.M{
		"$set": bson.M{"characters.$": char},
	}

	_, err := db.users.UpdateOne(ctx, filter, update)
	return err
}
