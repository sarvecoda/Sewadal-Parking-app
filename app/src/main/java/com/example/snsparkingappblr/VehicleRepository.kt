package com.example.snsparkingappblr

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

object VehicleRepository {

    private val db = FirebaseFirestore.getInstance()

    private const val ALL_COLLECTION   = "your_collection"     // rename as you like
    private const val TODAY_COLLECTION = "your_collection1"

    suspend fun add(vehicle: VehicleData, today: Boolean) =
        db.collection(if (today) TODAY_COLLECTION else ALL_COLLECTION)
            .add(vehicle).await()

    fun stream(
        today: Boolean,
        onUpdate: (List<Pair<String, VehicleData>>) -> Unit,
        onError : (Exception) -> Unit
    ) = db.collection(if (today) TODAY_COLLECTION else ALL_COLLECTION)
        .addSnapshotListener { snap, e ->
            if (e != null) { onError(e); return@addSnapshotListener }
            onUpdate(
                snap!!.documents.mapNotNull { d ->
                    d.toObject(VehicleData::class.java)?.let { d.id to it }
                }
            )
        }

    suspend fun delete(docId: String, today: Boolean) =
        db.collection(if (today) TODAY_COLLECTION else ALL_COLLECTION)
            .document(docId).delete().await()

    suspend fun deleteAll(today: Boolean) {
        val col  = db.collection(if (today) TODAY_COLLECTION else ALL_COLLECTION)
        val snap = col.get().await()
        db.runBatch { b -> snap.documents.forEach { b.delete(it.reference) } }.await()
    }
}
