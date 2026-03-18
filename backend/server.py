from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB - CORREGIDO: Lee DB_NAME del environment
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
DB_NAME = os.getenv("DB_NAME", "calculadora_precios")
db = client[DB_NAME]

# Colecciones
productos_col = db["productos"]
flujos_col = db["flujos"]
calculos_col = db["calculos"]
cotizaciones_col = db["cotizaciones"]

# ==================== MODELS ====================

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}

class Operacion(BaseModel):
    nombre: str
    tipo_operacion: str
    tipo_valor: str
    orden: int

class Flujo(BaseModel):
    nombre: str
    operaciones: List[Operacion] = []
    fecha_creacion: Optional[datetime] = None

class FlujoResponse(Flujo):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class Producto(BaseModel):
    nombre: str
    costo_original: float
    costo_base: float
    flujo_id: Optional[str] = None
    comentarios: Optional[str] = ""
    fecha_creacion: Optional[datetime] = None

class ProductoResponse(Producto):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class Cliente(BaseModel):
    nombre: str
    porcentaje_ganancia: float
    comentario: Optional[str] = ""
    precio_final: float

class Calculo(BaseModel):
    nombre_producto: str
    flujo_nombre: str
    flujo_id: Optional[str] = None
    valores_operaciones: Dict[str, float] = {}
    clientes: List[Cliente] = []
    costo_base: float
    fecha: Optional[datetime] = None

class CalculoResponse(Calculo):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class ItemCotizacion(BaseModel):
    cantidad: int
    producto_id: str
    nombre_producto: str
    precio_unitario: float
    subtotal: float

class Cotizacion(BaseModel):
    nombre_cliente: Optional[str] = ""
    items: List[ItemCotizacion] = []
    total: float
    fecha: Optional[datetime] = None

class CotizacionResponse(Cotizacion):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class CalcularPrecioRequest(BaseModel):
    costo_base: float
    flujo_id: str
    valores_operaciones: Dict[str, float]
    clientes: List[Dict[str, Any]]

# ==================== HELPERS ====================

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def aplicar_operacion(precio_base: float, operacion: dict, valor: float) -> float:
    tipo_op = operacion["tipo_operacion"]
    tipo_val = operacion["tipo_valor"]
    
    if tipo_val == "Porcentaje":
        if tipo_op == "Sumar":
            return precio_base + (precio_base * valor / 100)
        elif tipo_op == "Restar":
            return precio_base - (precio_base * valor / 100)
        elif tipo_op == "Multiplicar":
            return precio_base * (valor / 100)
        elif tipo_op == "Dividir":
            return precio_base / (valor / 100) if valor != 0 else precio_base
    else:
        if tipo_op == "Sumar":
            return precio_base + valor
        elif tipo_op == "Restar":
            return precio_base - valor
        elif tipo_op == "Multiplicar":
            return precio_base * valor
        elif tipo_op == "Dividir":
            return precio_base / valor if valor != 0 else precio_base
    
    return precio_base

# ==================== ENDPOINTS PRODUCTOS ====================

@app.get("/api/productos")
def get_productos(skip: int = 0, limit: int = 100):
    productos = list(productos_col.find().skip(skip).limit(limit))
    return [serialize_doc(p) for p in productos]

@app.get("/api/productos/buscar")
def buscar_productos(q: str):
    regex = {"$regex": q, "$options": "i"}
    productos = list(productos_col.find({"nombre": regex}).limit(20))
    return [serialize_doc(p) for p in productos]

@app.get("/api/productos/{producto_id}")
def get_producto(producto_id: str):
    producto = productos_col.find_one({"_id": ObjectId(producto_id)})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return serialize_doc(producto)

@app.post("/api/productos")
def crear_producto(producto: Producto):
    producto_dict = producto.model_dump()
    producto_dict["fecha_creacion"] = datetime.now()
    result = productos_col.insert_one(producto_dict)
    producto_dict["_id"] = str(result.inserted_id)
    return serialize_doc(producto_dict)

@app.put("/api/productos/{producto_id}")
def actualizar_producto(producto_id: str, producto: Producto):
    result = productos_col.update_one(
        {"_id": ObjectId(producto_id)},
        {"$set": producto.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto actualizado"}

@app.delete("/api/productos/{producto_id}")
def eliminar_producto(producto_id: str):
    result = productos_col.delete_one({"_id": ObjectId(producto_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado"}

# ==================== ENDPOINTS FLUJOS ====================

@app.get("/api/flujos")
def get_flujos():
    flujos = list(flujos_col.find())
    return [serialize_doc(f) for f in flujos]

@app.get("/api/flujos/{flujo_id}")
def get_flujo(flujo_id: str):
    flujo = flujos_col.find_one({"_id": ObjectId(flujo_id)})
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return serialize_doc(flujo)

@app.post("/api/flujos")
def crear_flujo(flujo: Flujo):
    flujo_dict = flujo.model_dump()
    flujo_dict["fecha_creacion"] = datetime.now()
    result = flujos_col.insert_one(flujo_dict)
    flujo_dict["_id"] = str(result.inserted_id)
    return serialize_doc(flujo_dict)

@app.put("/api/flujos/{flujo_id}")
def actualizar_flujo(flujo_id: str, flujo: Flujo):
    result = flujos_col.update_one(
        {"_id": ObjectId(flujo_id)},
        {"$set": flujo.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return {"message": "Flujo actualizado"}

@app.delete("/api/flujos/{flujo_id}")
def eliminar_flujo(flujo_id: str):
    result = flujos_col.delete_one({"_id": ObjectId(flujo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return {"message": "Flujo eliminado"}

# ==================== ENDPOINTS CÁLCULOS ====================

@app.get("/api/calculos")
def get_calculos(skip: int = 0, limit: int = 50, 
                 nombre: Optional[str] = None,
                 fecha_desde: Optional[str] = None,
                 fecha_hasta: Optional[str] = None):
    query = {}
    
    if nombre:
        query["nombre_producto"] = {"$regex": nombre, "$options": "i"}
    
    if fecha_desde or fecha_hasta:
        query["fecha"] = {}
        if fecha_desde:
            query["fecha"]["$gte"] = datetime.fromisoformat(fecha_desde)
        if fecha_hasta:
            query["fecha"]["$lte"] = datetime.fromisoformat(fecha_hasta)
    
    calculos = list(calculos_col.find(query).sort("fecha", -1).skip(skip).limit(limit))
    return [serialize_doc(c) for c in calculos]

@app.get("/api/calculos/{calculo_id}")
def get_calculo(calculo_id: str):
    calculo = calculos_col.find_one({"_id": ObjectId(calculo_id)})
    if not calculo:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return serialize_doc(calculo)

@app.post("/api/calculos")
def guardar_calculo(calculo: Calculo):
    calculo_dict = calculo.model_dump()
    calculo_dict["fecha"] = datetime.now()
    result = calculos_col.insert_one(calculo_dict)
    calculo_dict["_id"] = str(result.inserted_id)
    return serialize_doc(calculo_dict)

@app.delete("/api/calculos/{calculo_id}")
def eliminar_calculo(calculo_id: str):
    result = calculos_col.delete_one({"_id": ObjectId(calculo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return {"message": "Cálculo eliminado"}

# ==================== ENDPOINTS COTIZACIONES ====================

@app.get("/api/cotizaciones")
def get_cotizaciones(skip: int = 0, limit: int = 50):
    cotizaciones = list(cotizaciones_col.find().sort("fecha", -1).skip(skip).limit(limit))
    return [serialize_doc(c) for c in cotizaciones]

@app.get("/api/cotizaciones/{cotizacion_id}")
def get_cotizacion(cotizacion_id: str):
    cotizacion = cotizaciones_col.find_one({"_id": ObjectId(cotizacion_id)})
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return serialize_doc(cotizacion)

@app.post("/api/cotizaciones")
def crear_cotizacion(cotizacion: Cotizacion):
    cotizacion_dict = cotizacion.model_dump()
    cotizacion_dict["fecha"] = datetime.now()
    result = cotizaciones_col.insert_one(cotizacion_dict)
    cotizacion_dict["_id"] = str(result.inserted_id)
    return serialize_doc(cotizacion_dict)

@app.put("/api/cotizaciones/{cotizacion_id}")
def actualizar_cotizacion(cotizacion_id: str, cotizacion: Cotizacion):
    result = cotizaciones_col.update_one(
        {"_id": ObjectId(cotizacion_id)},
        {"$set": cotizacion.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"message": "Cotización actualizada"}

@app.delete("/api/cotizaciones/{cotizacion_id}")
def eliminar_cotizacion(cotizacion_id: str):
    result = cotizaciones_col.delete_one({"_id": ObjectId(cotizacion_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"message": "Cotización eliminada"}

# ==================== ENDPOINT CALCULAR ====================

@app.post("/api/calcular")
def calcular_precio(request: CalcularPrecioRequest):
    flujo = flujos_col.find_one({"_id": ObjectId(request.flujo_id)})
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    
    precio_actual = request.costo_base
    operaciones = sorted(flujo.get("operaciones", []), key=lambda x: x["orden"])
    
    for operacion in operaciones:
        nombre_op = operacion["nombre"]
        valor = request.valores_operaciones.get(nombre_op, 0)
        precio_actual = aplicar_operacion(precio_actual, operacion, valor)
    
    resultados = []
    for cliente in request.clientes:
        precio_con_ganancia = precio_actual
        ganancia = cliente.get("porcentaje_ganancia", 0)
        
        if ganancia > 0:
            precio_con_ganancia = precio_actual + (precio_actual * ganancia / 100)
        
        resultados.append({
            "nombre": cliente["nombre"],
            "porcentaje_ganancia": ganancia,
            "comentario": cliente.get("comentario", ""),
            "precio_final": round(precio_con_ganancia, 2)
        })
    
    return {
        "costo_base": round(precio_actual, 2),
        "resultados": resultados
    }

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "database": DB_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
