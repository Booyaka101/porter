package porterui

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"path/filepath"
)

var encryptionKey []byte

// InitEncryption initializes the encryption key
func InitEncryption() error {
	keyPath := filepath.Join(getDataDir(), ".key")

	// Try to load existing key
	if data, err := os.ReadFile(keyPath); err == nil && len(data) == 32 {
		encryptionKey = data
		return nil
	}

	// Generate new key
	encryptionKey = make([]byte, 32)
	if _, err := rand.Read(encryptionKey); err != nil {
		return err
	}

	// Save key
	if err := os.MkdirAll(filepath.Dir(keyPath), 0700); err != nil {
		return err
	}
	return os.WriteFile(keyPath, encryptionKey, 0600)
}

// DeriveKey derives a key from a passphrase
func DeriveKey(passphrase string) []byte {
	hash := sha256.Sum256([]byte(passphrase))
	return hash[:]
}

// Encrypt encrypts plaintext using AES-GCM
func Encrypt(plaintext string) (string, error) {
	if encryptionKey == nil {
		return plaintext, nil // Fallback if encryption not initialized
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts ciphertext using AES-GCM
func Decrypt(ciphertext string) (string, error) {
	if encryptionKey == nil {
		return ciphertext, nil // Fallback if encryption not initialized
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		// Not encrypted, return as-is (for backward compatibility)
		return ciphertext, nil
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		// Too short to be encrypted, return as-is
		return ciphertext, nil
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		// Decryption failed, might be plain text
		return ciphertext, nil
	}

	return string(plaintext), nil
}

// IsEncrypted checks if a string appears to be encrypted
func IsEncrypted(s string) bool {
	if len(s) < 20 {
		return false
	}
	_, err := base64.StdEncoding.DecodeString(s)
	return err == nil
}

// EncryptPassword encrypts a password for storage
func EncryptPassword(password string) (string, error) {
	if password == "" {
		return "", nil
	}
	return Encrypt(password)
}

// DecryptPassword decrypts a stored password
func DecryptPassword(encrypted string) (string, error) {
	if encrypted == "" {
		return "", nil
	}
	return Decrypt(encrypted)
}

// MigratePasswords encrypts any plain-text passwords in machines
func MigratePasswords(machines []Machine) ([]Machine, bool, error) {
	changed := false
	for i := range machines {
		if machines[i].Password != "" && !IsEncrypted(machines[i].Password) {
			encrypted, err := EncryptPassword(machines[i].Password)
			if err != nil {
				return machines, false, err
			}
			machines[i].Password = encrypted
			changed = true
		}
	}
	return machines, changed, nil
}

// GetDecryptedPassword returns the decrypted password for a machine
func GetDecryptedPassword(m *Machine) string {
	decrypted, err := DecryptPassword(m.Password)
	if err != nil {
		return m.Password // Return as-is if decryption fails
	}
	return decrypted
}

var ErrEncryptionNotInitialized = errors.New("encryption not initialized")
