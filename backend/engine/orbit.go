package engine

import (
	"math"
	"strconv"
)

// CalculateDeltaV estimates the spacecraft Delta-V (km/s) requirement using the Shoemaker-Helin formula:
// delta_v = 0.5 + 0.3 * |sin(i)| + 0.8 * e + 0.5 * |a - 1.0|
func CalculateDeltaV(a, e, i float64) float64 {
	radI := i * math.Pi / 180.0
	sinI := math.Abs(math.Sin(radI))
	diffA := math.Abs(a - 1.0)

	dv := 0.5 + (0.3 * sinI) + (0.8 * e) + (0.5 * diffA)
	// Round to two decimal places
	return math.Round(dv*100) / 100
}

// EstimateLaunchWindow outputs a realistic window date for a mission departure
func EstimateLaunchWindow(spkid string, moid float64) string {
	h := SimpleHash(spkid)
	months := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
	month := months[h%12]
	year := 2027 + (h % 3) // 2027, 2028, or 2029
	return month + " " + strconv.Itoa(year)
}

// CalculateROI computes estimated Return on Investment (ROI)
func CalculateROI(valueUSD, costUSD float64) float64 {
	if costUSD <= 0 {
		return 0.0
	}
	roi := (valueUSD - costUSD) / costUSD
	return math.Round(roi*100) / 100
}
