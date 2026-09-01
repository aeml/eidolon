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
	client      *mongo.Client
	users       *mongo.Collection
	auctions    *mongo.Collection
	friendships *mongo.Collection
}

type User struct {
	Username     string       `bson:"username"`
	Email        string       `bson:"email"`
	PasswordHash string       `bson:"password_hash"`
	CreatedAt    time.Time    `bson:"created_at"`
	Characters   []*Character `bson:"characters"`
}

type Auction struct {
	ID         string    `bson:"id"`
	SellerID   string    `bson:"seller_id"`
	SellerName string    `bson:"seller_name"`
	Item       Item      `bson:"item"`
	Bid        int       `bson:"bid"`
	Buyout     int       `bson:"buyout"`
	Duration   int       `bson:"duration"`
	StartTime  time.Time `bson:"start_time"`
	EndTime    time.Time `bson:"end_time"`
	Status     string    `bson:"status"`
	BuyerID    string    `bson:"buyer_id"`
	BidderID   string    `bson:"bidder_id"`
	BidderName string    `bson:"bidder_name"`
	Deposit    int       `bson:"deposit"`
}

type Character struct {
	Name           string            `bson:"name"`
	Class          string            `bson:"class"` // Fighter, Wizard, etc.
	Level          int               `bson:"level"`
	XP             int               `bson:"xp"`
	Gold           int               `bson:"gold"`
	X              float64           `bson:"x"`
	Y              float64           `bson:"y"`
	Z              float64           `bson:"z"`
	InstanceID     string            `bson:"instance_id"`
	LastLogout     time.Time         `bson:"last_logout"`
	Stats          Stats             `bson:"stats"`
	Inventory      []Item            `bson:"inventory"`
	Stash          []Item            `bson:"stash"`
	Buyback        []Item            `bson:"buyback"`
	Equipment      map[string]Item   `bson:"equipment"`
	Quests         []Quest           `bson:"quests"`
	LastDailyQuest time.Time         `bson:"last_daily_quest"`
	SkillPoints    int               `bson:"skill_points"`
	SelectedBranch string            `bson:"selected_branch"`
	UnlockedSkills []string          `bson:"unlocked_skills"`
	SkillRunes     map[string]string `bson:"skill_runes,omitempty"` // skill name -> rune ID
	// Passive talents
	UnlockedTalents []string       `bson:"unlocked_talents"` // legacy: treated as rank 1 per id
	TalentRanks     map[string]int `bson:"talent_ranks,omitempty"`
	// Social
	PartyID string `bson:"party_id,omitempty"`
}

type Quest struct {
	ID        string `bson:"id"`
	Type      string `bson:"type"` // "KILL"
	Target    string `bson:"target"`
	Count     int    `bson:"count"`
	MaxCount  int    `bson:"max_count"`
	RewardXP  int    `bson:"reward_xp"`
	Completed bool   `bson:"completed"`
	Accepted  bool   `bson:"accepted"`
}

type Stats struct {
	Strength     int `bson:"strength"`
	Dexterity    int `bson:"dexterity"`
	Intelligence int `bson:"intelligence"`
	Wisdom       int `bson:"wisdom"`
	Vitality     int `bson:"vitality"`
}

type Item struct {
	ID               string         `bson:"id"`
	Name             string         `bson:"name"`
	Type             string         `bson:"type"` // WEAPON, ARMOR
	Slot             string         `bson:"slot"`
	Rarity           string         `bson:"rarity"`
	Level            int            `bson:"level"`
	Stats            map[string]int `bson:"stats"`
	Value            int            `bson:"value"`
	Icon             string         `bson:"icon"`
	Description      string         `bson:"description"`
	Stack            int            `bson:"stack"`
	MaxStack         int            `bson:"max_stack"`
	Potency          int            `bson:"potency"`
	Sockets          int            `bson:"sockets"`
	StatScaleVersion int            `bson:"stat_scale_version,omitempty"`
}

// FriendshipPending and FriendshipAccepted are the two valid status values for a Friendship document.
const (
	FriendshipPending  = "pending"
	FriendshipAccepted = "accepted"
)

// Friendship represents a directed friend request or established friendship between two players.
// RequesterID is the player who sent the request; AddresseeID is the recipient.
// To find all friendships for a player, query both requester_id and addressee_id sides.
type Friendship struct {
	RequesterID string    `bson:"requester_id"`
	AddresseeID string    `bson:"addressee_id"`
	Status      string    `bson:"status"`
	CreatedAt   time.Time `bson:"created_at"`
	UpdatedAt   time.Time `bson:"updated_at"`
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
	auctions := db.Collection("auctions")
	friendships := db.Collection("friendships")

	// Create unique index on username
	_, err = users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "username", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return nil, err
	}

	// Unique compound index prevents duplicate directed requests.
	_, err = friendships.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "requester_id", Value: 1}, {Key: "addressee_id", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return nil, err
	}

	// Index for fast reverse-lookup (incoming requests / accepted friendships for addressee side).
	_, err = friendships.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "addressee_id", Value: 1}},
	})
	if err != nil {
		return nil, err
	}

	return &DB{
		client:      client,
		users:       users,
		auctions:    auctions,
		friendships: friendships,
	}, nil
}

// Ping verifies that the database backing the authoritative game state is ready.
func (db *DB) Ping(ctx context.Context) error {
	if db == nil || db.client == nil {
		return errors.New("database client is not initialized")
	}
	return db.client.Ping(ctx, nil)
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
		Characters:   make([]*Character, 0),
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

func (db *DB) SetFirstCharacter(username string, char *Character) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"username": username}
	update := bson.M{"$set": bson.M{"characters": []*Character{char}}}

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

func (db *DB) CreateAuction(auction *Auction) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.auctions.InsertOne(ctx, auction)
	return err
}

func (db *DB) UpdateAuction(auction *Auction) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"id": auction.ID}
	update := bson.M{"$set": auction}

	_, err := db.auctions.UpdateOne(ctx, filter, update)
	return err
}

func (db *DB) DeleteAuction(auctionID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.auctions.DeleteOne(ctx, bson.M{"id": auctionID})
	return err
}

func (db *DB) LoadAuctions() ([]*Auction, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := db.auctions.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var auctions []*Auction
	if err = cursor.All(ctx, &auctions); err != nil {
		return nil, err
	}
	return auctions, nil
}

// SendFriendRequest creates a pending friendship document from requesterID to addresseeID.
// Returns an error if any relationship (in either direction) already exists.
func (db *DB) SendFriendRequest(requesterID, addresseeID string) error {
	if requesterID == addresseeID {
		return errors.New("cannot send friend request to yourself")
	}

	existing, err := db.GetFriendship(requesterID, addresseeID)
	if err != nil {
		return err
	}
	if existing != nil {
		return errors.New("relationship already exists")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	doc := Friendship{
		RequesterID: requesterID,
		AddresseeID: addresseeID,
		Status:      FriendshipPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err = db.friendships.InsertOne(ctx, doc)
	if mongo.IsDuplicateKeyError(err) {
		return errors.New("relationship already exists")
	}
	return err
}

// AcceptFriendRequest promotes a pending request (requesterID → addresseeID) to accepted.
func (db *DB) AcceptFriendRequest(requesterID, addresseeID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"requester_id": requesterID,
		"addressee_id": addresseeID,
		"status":       FriendshipPending,
	}
	update := bson.M{"$set": bson.M{"status": FriendshipAccepted, "updated_at": time.Now()}}

	result, err := db.friendships.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("pending friend request not found")
	}
	return nil
}

// DeclineFriendRequest removes a pending request (requesterID → addresseeID) without accepting it.
func (db *DB) DeclineFriendRequest(requesterID, addresseeID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"requester_id": requesterID,
		"addressee_id": addresseeID,
		"status":       FriendshipPending,
	}
	result, err := db.friendships.DeleteOne(ctx, filter)
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("pending friend request not found")
	}
	return nil
}

// RemoveFriend deletes an accepted friendship between two players (order-independent).
func (db *DB) RemoveFriend(playerA, playerB string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": bson.A{
			bson.M{"requester_id": playerA, "addressee_id": playerB},
			bson.M{"requester_id": playerB, "addressee_id": playerA},
		},
		"status": FriendshipAccepted,
	}
	result, err := db.friendships.DeleteOne(ctx, filter)
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("friendship not found")
	}
	return nil
}

// GetFriends returns all accepted friendships in which playerID appears on either side.
func (db *DB) GetFriends(playerID string) ([]*Friendship, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": bson.A{
			bson.M{"requester_id": playerID},
			bson.M{"addressee_id": playerID},
		},
		"status": FriendshipAccepted,
	}
	cursor, err := db.friendships.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var result []*Friendship
	if err = cursor.All(ctx, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetPendingRequests returns all pending friendship documents where playerID is the addressee
// (i.e. incoming requests that playerID has not yet responded to).
func (db *DB) GetPendingRequests(addresseeID string) ([]*Friendship, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"addressee_id": addresseeID,
		"status":       FriendshipPending,
	}
	cursor, err := db.friendships.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var result []*Friendship
	if err = cursor.All(ctx, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetFriendship returns the friendship document between two players regardless of direction,
// or nil if no relationship exists.
func (db *DB) GetFriendship(playerA, playerB string) (*Friendship, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": bson.A{
			bson.M{"requester_id": playerA, "addressee_id": playerB},
			bson.M{"requester_id": playerB, "addressee_id": playerA},
		},
	}
	var f Friendship
	err := db.friendships.FindOne(ctx, filter).Decode(&f)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}
