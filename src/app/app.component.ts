import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

interface MarkerData {
  latitude: number;
  longitude: number;
  iconSize: [number, number];
  popupContent: string;
  iconUrl: string;
  atractionType: string;
  Lager_id: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [HttpClientModule]
})
export class AppComponent implements OnInit {
  title1: string = '';
  title2: string = '';
  title3: string = '';

  private map: any;
  private markers: any[] = [];

  // ViewChild to access the filter checkboxes
  @ViewChild('gluhwein') gluhweinCheckbox: ElementRef | undefined;
  @ViewChild('gastronomie') gastronomieCheckbox: ElementRef | undefined;
  @ViewChild('sonst') defaultCheckbox: ElementRef | undefined;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    // Fetch text titles
    this.http.get<{ title1: string, title2: string, title3: string }>('/api/text')
      .subscribe(response => {
        this.title1 = response.title1;
        this.title2 = response.title2;
        this.title3 = response.title3;
      }, error => {
        console.error('Error fetching titles from backend:', error);
      });

    // Fetch marker data and initialize map if in browser
    if (isPlatformBrowser(this.platformId)) {
      this.loadLeaflet();
    }
  }

  onCheckboxChange() {
    this.fetchMarkers(); // Call fetchMarkers whenever the checkbox is clicked
  }

  private loadLeaflet(): void {
    if (isPlatformBrowser(this.platformId)) {
      import('leaflet').then(L => {
        import('leaflet-rotatedmarker');
        this.map = L.map('map').setView([53.5508611, 9.993], 18);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 20,
          maxNativeZoom: 19,
          minZoom: 10,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        this.map.on('zoomend', this.onZoom.bind(this));
        this.fetchMarkers();
      }).catch(error => {
        console.error('Error loading Leaflet library:', error);
      });
    }
  }

  private fetchMarkers(): void {
    // Fetch markers data
    this.http.get<{ markers: MarkerData[], markerBig: MarkerData[] }>('/api/text')
      .subscribe(response => {
        const markersData = response.markers;
        const markerBigData = response.markerBig;
        // Call updateMarkers with both datasets
        this.updateMarkers(markersData, markerBigData);
      }, error => {
        console.error('Error fetching markers from backend:', error);
      });
  }

  private onZoom(event: any) {
    this.fetchMarkers(); // Re-fetch markers on zoom to potentially adjust icon sizes
  }

  private updateMarkers(markersData: MarkerData[], markerBigData: MarkerData[]): void {
    if (!this.map) return;

    // Calculate dynamic icon size based on zoom level
    const iconSizeFactor = this.map.getZoom() > 16 ? (1/2)**(19-this.map.getZoom()): (4/5)**(16-this.map.getZoom());
    const markersAll = this.map.getZoom() > 16 ? markersData : markerBigData;


    // Clear previous markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    let iconName = "";

    import('leaflet').then(L => {
      import('leaflet-rotatedmarker');
      markersAll.forEach(markerData => {
        let iconColour = "";
        if (markerData.atractionType == "gluhwein" && this.gluhweinCheckbox?.nativeElement?.checked) {
          iconColour = "#00008a";
        } else if (markerData.atractionType == "gastronomie" && this.gastronomieCheckbox?.nativeElement?.checked) {
          iconColour = "#1F4A2B";
        } else if (markerData.atractionType == null && this.defaultCheckbox?.nativeElement?.checked){
          iconColour = "#942222";
        } else {
          return
        }

        let iconNewName = 'data:image/svg+xml;base64,' +
          btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 500 500">
                <rect width="300" height="300" x="100" y="100"
                  style="opacity:1.0; fill:${iconColour}; fill-opacity:1.0; stroke:${iconColour}; stroke-width:8; stroke-linecap:round; stroke-linejoin:round; stroke-miterlimit:4; stroke-opacity:1.0" />
                <text x="250" y="250" fill="white" font-size="120" text-anchor="middle" dominant-baseline="middle">${markerData.Lager_id}</text>
             </svg>
          `);



        const icon = L.icon({
          iconUrl: iconNewName,
          iconSize: [iconSizeFactor * markerData.iconSize[0]/2.5, iconSizeFactor * markerData.iconSize[1]/2.5],
          iconAnchor: [iconSizeFactor * markerData.iconSize[0] / 5, iconSizeFactor * markerData.iconSize[1] / 5],
        });

        const marker = L.marker(getGeoCoordinate(markerData.latitude, markerData.longitude), {
          icon,
          rotationAngle: 45, // Set the rotation angle
          rotationOrigin: 'center center',
          title: markerData.atractionType,
        })
          .bindPopup(markerData.popupContent)
          .addTo(this.map);

        this.markers.push(marker);
      });
    }).catch(error => {
      console.error('Error loading icons for markers:', error);
    });
  }
}



type GeoCoordinate = [number, number];

function interpolate(a: number, b: number, factor: number): number {
  return a + (b - a) * factor;
}

function getGeoCoordinate(x: number, y: number): GeoCoordinate {
  // Ensure x and y are within the expected range
  if (y < 1 || y > 21 || x < 1 || x > 12) {
    throw new Error("x must be between 0 and 21, and y must be between 0 and 12");
  }

  const topLeft: GeoCoordinate = [53.5503, 9.9933];
  const topRight: GeoCoordinate = [53.55055, 9.994];
  const bottomRight: GeoCoordinate = [53.55129, 9.9929];
  const bottomLeft: GeoCoordinate = [53.55105, 9.9921];

  // Calculate interpolation factors
  const xFactor = x / 12;
  const yFactor = y / 21;

  // Interpolate along the top and bottom edges
  const topLatitude = interpolate(topLeft[0], topRight[0], xFactor);
  const topLongitude = interpolate(topLeft[1], topRight[1], xFactor);
  const bottomLatitude = interpolate(bottomLeft[0], bottomRight[0], xFactor);
  const bottomLongitude = interpolate(bottomLeft[1], bottomRight[1], xFactor);

  // Interpolate between the top and bottom interpolated points
  const latitude = interpolate(bottomLatitude, topLatitude, yFactor);
  const longitude = interpolate(bottomLongitude, topLongitude, yFactor);

  return [latitude, longitude];
}
